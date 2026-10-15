/**
 * decisionSync.ts — фиксация решения команды по карточке в X-Lance:
 *
 *   1. длина задачи работ   → `updateTask` (http) либо демо-Ганта (mock);
 *   2. запрос на изменение  → оформление и утверждение у Заказчика;
 *   3. удовлетворённость    → пользовательский показатель 40–130 %;
 *   4. журнал               → запись о решении и о каждой операции.
 *
 * Ошибки не прерывают игру: они попадают в журнал с признаком `ok: false`.
 */
import { api } from './api';
import { MODULE_LABELS, moduleForAction } from './config';
import { clampSatisfaction, formatSignedDays } from '../game/engine';
import type { TeamId } from '../data/projects';
import type { Card, RoundDecision, Variant } from '../game/types';

export interface SyncDecisionParams {
  teamId: TeamId;
  card: Card;
  variant: Variant;
  decision: RoundDecision;
  /** Удовлетворённость до решения — чтобы отправить итоговое значение показателя. */
  satisfactionBefore: number;
}

/** Зафиксировать решение команды в X-Lance (mock/http — по режиму API). */
export async function syncDecisionToXl(params: SyncDecisionParams): Promise<void> {
  const { teamId, card, variant, decision } = params;
  const module = MODULE_LABELS[moduleForAction(card.id)];
  const action = `${card.title}: вариант ${variant.key} — ${variant.label}`;
  const payload = {
    days: decision.deltaDays,
    cost: decision.deltaCost,
    income: decision.deltaRevenue,
    satisfaction: decision.deltaSatisfaction,
  };

  /* ------------------------- 1. длительность задачи ------------------------- */
  if (decision.deltaDays !== 0) {
    const taskLabel = variant.targetTask ? `«${variant.targetTask}»` : 'проекта';
    const logAction = `${action} · длительность ${taskLabel} ${formatSignedDays(decision.deltaDays)}`;
    try {
      const result = await api.tasks.changeDuration(teamId, variant.targetTask ?? null, decision.deltaDays);
      api.sync.log(teamId, module, logAction, result.changed, { ...payload, ...result });
    } catch (error) {
      api.sync.log(teamId, module, logAction, false, payload, String(error));
    }
  }

  /* ------------------------ 2. запрос на изменение -------------------------- */
  if (decision.isChangeRequest) {
    const logAction = `${action} · запрос на изменение`;
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
      api.sync.log(teamId, MODULE_LABELS['change-requests'], `${logAction} утверждён`, true, {
        ...payload,
        changeRequestId: request.id,
      });
    } catch (error) {
      api.sync.log(teamId, MODULE_LABELS['change-requests'], logAction, false, payload, String(error));
    }
  }

  /* ----------------------- 3. удовлетворённость заказчика ------------------- */
  try {
    await api.indicators.setValue(
      teamId,
      'customer-satisfaction',
      clampSatisfaction(params.satisfactionBefore + decision.deltaSatisfaction),
    );
  } catch (error) {
    api.sync.log(teamId, MODULE_LABELS['custom-metrics'], `${action} · удовлетворённость`, false, payload, String(error));
  }

  /* ------------------------------ 4. журнал --------------------------------- */
  api.sync.log(teamId, module, action, true, payload);
}
