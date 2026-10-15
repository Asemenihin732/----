/**
 * decisionSync.ts — фиксация решения команды по карточке в X-Lance:
 *
 *   1. задачи и ресурсы     → действия из колоды (`variant.actions`: длительность,
 *                             новые задачи, трудозатраты, переназначения);
 *                             без действий — длительность задачи по `deltaDays`;
 *   2. запрос на изменение  → оформление и утверждение у Заказчика;
 *   3. платежи              → исходящие/входящие платежи из сценария карточки
 *                             (если карточка их не описывает — из её денежных
 *                             изменений, см. cardPayments);
 *   4. удовлетворённость    → пользовательский показатель 40–130 %;
 *   5. журнал и отчёт       → запись о каждой операции + отчёт по пунктам
 *                             (syncReports.ts) для статуса и повтора в интерфейсе.
 *
 * Ошибки не прерывают игру. `only` — ключи пунктов для повтора: выполняются
 * только они, остальные пункты отчёта сохраняются как были.
 */
import { api } from './api';
import { journalLog } from './journal';
import { cardPayments, syncCardPayments } from './paymentSync';
import { describeAction, runCardActions } from './taskActions';
import { MODULE_LABELS, moduleForAction } from './config';
import { loadSyncReport, markSyncPending, mergeSyncItems, saveSyncReport, type SyncItem, type SyncReport } from './syncReports';
import { clampSatisfaction, formatSignedDays, formatSignedRub } from '../game/engine';
import type { TeamId } from '../data/projects';
import type { Card, RoundDecision, Variant, XlAction } from '../game/types';

export interface SyncDecisionParams {
  teamId: TeamId;
  card: Card;
  variant: Variant;
  decision: RoundDecision;
  /** Удовлетворённость до решения — чтобы отправить итоговое значение показателя. */
  satisfactionBefore: number;
}

/** Действие меняет деньги проекта: трудозатраты, исполнители, новая работа с людьми. */
const isFinancialAction = (a: XlAction): boolean =>
  a.type === 'labor' || a.type === 'reassign' || (a.type === 'addTask' && Boolean(a.assign?.length));

/** Зафиксировать решение команды в X-Lance и вернуть отчёт по пунктам. */
export async function syncDecisionToXl(params: SyncDecisionParams, only?: Set<string>): Promise<SyncReport> {
  const { teamId, card, variant, decision } = params;
  const module = MODULE_LABELS[moduleForAction(card.id)];
  const action = `${card.title}: вариант ${variant.key} — ${variant.label}`;
  const payload = {
    days: decision.deltaDays,
    cost: decision.deltaCost,
    income: decision.deltaRevenue,
    satisfaction: decision.deltaSatisfaction,
  };
  const want = (key: string) => !only || only.has(key);
  const items: SyncItem[] = [];
  const base = { teamId, round: decision.round, cardTitle: card.title, variantKey: variant.key };
  markSyncPending(base);

  /* ---------------------- 1. задачи и ресурсы X-Lance ---------------------- */
  if (variant.actions) {
    const picked = variant.actions.map((a, i) => ({ a, key: `action:${i}` })).filter((x) => want(x.key));
    try {
      const results = await runCardActions(teamId, picked.map((x) => x.a));
      results.forEach((r, i) => {
        const label = describeAction(r.action);
        journalLog(teamId, module, `${action} · ${label}${r.message ? ` — ${r.message}` : ''}`, r.ok, payload, r.error);
        items.push({
          key: picked[i].key,
          kind: r.action.type === 'manual' ? 'manual' : 'task',
          financial: isFinancialAction(r.action),
          label,
          ok: r.ok,
          skipped: r.skipped,
          error: r.error,
        });
      });
    } catch (error) {
      for (const x of picked) {
        items.push({
          key: x.key,
          kind: 'task',
          financial: isFinancialAction(x.a),
          label: describeAction(x.a),
          ok: false,
          error: String(error),
        });
      }
      journalLog(teamId, module, `${action} · задачи и ресурсы`, false, payload, String(error));
    }
  } else if (decision.deltaDays !== 0 && want('duration')) {
    const taskLabel = variant.targetTask ? `«${variant.targetTask}»` : 'проекта';
    const label = `длительность ${taskLabel} ${formatSignedDays(decision.deltaDays)}`;
    try {
      const result = await api.tasks.changeDuration(teamId, variant.targetTask ?? null, decision.deltaDays);
      journalLog(teamId, module, `${action} · ${label}`, result.changed, { ...payload, ...result });
      items.push({ key: 'duration', kind: 'task', financial: false, label, ok: result.changed, error: result.reason });
    } catch (error) {
      journalLog(teamId, module, `${action} · ${label}`, false, payload, String(error));
      items.push({ key: 'duration', kind: 'task', financial: false, label, ok: false, error: String(error) });
    }
  }

  /* ------------------------ 2. запрос на изменение -------------------------- */
  if (decision.isChangeRequest && want('change-request')) {
    const label = 'запрос на изменение — утверждён Заказчиком';
    try {
      const request = await api.changeRequests.create({
        projectId: teamId,
        cardId: card.id,
        cardTitle: card.title,
        optionTitle: variant.label,
        deltaDays: decision.deltaDays,
        deltaCost: decision.deltaCost,
        deltaIncome: decision.deltaRevenue,
      });
      await api.changeRequests.approve(request.id, 'Утверждено Заказчиком (фасилитатор)');
      journalLog(teamId, MODULE_LABELS['change-requests'], `${action} · ${label}`, true, {
        ...payload,
        changeRequestId: request.id,
      });
      items.push({ key: 'change-request', kind: 'change-request', financial: false, label, ok: true });
    } catch (error) {
      journalLog(teamId, MODULE_LABELS['change-requests'], `${action} · запрос на изменение`, false, payload, String(error));
      items.push({ key: 'change-request', kind: 'change-request', financial: false, label, ok: false, error: String(error) });
    }
  }

  /* ---------------------------- 3. платежи ---------------------------------- */
  const paymentsModule = MODULE_LABELS['payment-calendar'];
  const pickedPayments = cardPayments(card, variant)
    .map((p, i) => ({ p, key: `payment:${i}` }))
    .filter((x) => want(x.key));
  if (pickedPayments.length > 0) {
    const labelOf = (p: (typeof pickedPayments)[number]['p']) =>
      p.reduce
        ? `сокращение расхода «${p.expenseItem ?? p.name}» ${formatSignedRub(-p.amount)}`
        : `${p.amount < 0 ? 'исходящий' : 'входящий'} платёж «${p.name}» ${formatSignedRub(p.amount)}`;
    try {
      const results = await syncCardPayments({
        teamId,
        card,
        variant,
        round: decision.round,
        payments: pickedPayments.map((x) => x.p),
      });
      results.forEach((r, i) => {
        const label = labelOf(r.payment);
        journalLog(teamId, paymentsModule, `${action} · ${label}${r.skipped ? ' (уже внесено)' : ''}`, r.ok, {
          ...payload,
          paymentId: r.paymentId,
        }, r.error);
        items.push({
          key: pickedPayments[i].key,
          kind: 'payment',
          financial: true,
          label,
          ok: r.ok,
          skipped: r.skipped,
          error: r.error,
        });
      });
    } catch (error) {
      journalLog(teamId, paymentsModule, `${action} · платежи`, false, payload, String(error));
      for (const x of pickedPayments) {
        items.push({ key: x.key, kind: 'payment', financial: true, label: labelOf(x.p), ok: false, error: String(error) });
      }
    }
  }

  /* ----------------------- 4. удовлетворённость заказчика ------------------- */
  if (want('satisfaction')) {
    const value = clampSatisfaction(params.satisfactionBefore + decision.deltaSatisfaction);
    const label = `удовлетворённость заказчика → ${value} %`;
    try {
      await api.indicators.setValue(teamId, 'customer-satisfaction', value);
      items.push({ key: 'satisfaction', kind: 'satisfaction', financial: false, label, ok: true });
    } catch (error) {
      journalLog(teamId, MODULE_LABELS['custom-metrics'], `${action} · удовлетворённость`, false, payload, String(error));
      items.push({ key: 'satisfaction', kind: 'satisfaction', financial: false, label, ok: false, error: String(error) });
    }
  }

  /* --------------------------- 5. журнал и отчёт ---------------------------- */
  journalLog(teamId, module, action, items.every((i) => i.ok), payload);
  const prev = loadSyncReport(teamId, decision.round);
  const report: SyncReport = {
    ...base,
    pending: false,
    at: new Date().toISOString(),
    items: only && prev ? mergeSyncItems(prev.items, items) : items,
  };
  saveSyncReport(report);
  return report;
}
