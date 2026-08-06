export interface ChromeCookie {
  name: string;
  value: string;
}

export interface ChromeCookiesApi {
  getAll(details: { url: string }): Promise<ChromeCookie[]>;
}

export interface ChromeApi {
  cookies: ChromeCookiesApi;
}