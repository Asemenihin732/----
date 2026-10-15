/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GraphQL-эндпоинт X-Lance (по умолчанию https://preview.x-lance.ru/api/graphql) */
  readonly VITE_XLANCE_API_URL: string;
  /** Bearer-токен доступа к X-Lance API */
  readonly VITE_XLANCE_API_TOKEN: string;
  /** ID рабочего пространства */
  readonly VITE_XLANCE_WORKSPACE_ID: string;
  /** Заголовок приложения */
  readonly VITE_APP_TITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
