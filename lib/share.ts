// 예약 내용을 손님 본인 카톡 등으로 보내기 (키 없이: 휴대폰 공유하기 / 복사, 키 있으면: 카카오톡 공유)
const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
const KAKAO_SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";

type KakaoSDK = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: { sendDefault: (o: unknown) => void };
};
declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

export const kakaoEnabled = () => Boolean(KAKAO_KEY);

function loadKakao(): Promise<KakaoSDK> {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  return new Promise((ok, fail) => {
    const el = document.createElement("script");
    el.src = KAKAO_SDK;
    el.async = true;
    el.onload = () => (window.Kakao ? ok(window.Kakao) : fail(new Error("kakao")));
    el.onerror = () => fail(new Error("kakao"));
    document.head.appendChild(el);
  });
}

/** 카카오톡 공유. 실패하면 false 를 돌려줘요. text 는 200자 안쪽이어야 해요. */
export async function shareKakao(text: string, url: string, button: string) {
  if (!KAKAO_KEY) return false;
  try {
    const K = await loadKakao();
    if (!K.isInitialized()) K.init(KAKAO_KEY);
    K.Share.sendDefault({
      objectType: "text",
      text: text.length > 200 ? text.slice(0, 197) + "…" : text,
      link: { mobileWebUrl: url, webUrl: url },
      buttonTitle: button,
    });
    return true;
  } catch {
    return false;
  }
}

/** 휴대폰 공유하기 창(카톡·문자·메모 선택). 지원하지 않거나 취소하면 false. */
export async function shareNative(title: string, text: string, url: string) {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share({ title, text: `${text}\n${url}` });
    return true;
  } catch (e) {
    // 사용자가 창을 닫은 경우도 여기로 와요. 그때는 복사로 넘어가지 않아요.
    return (e as Error)?.name === "AbortError" ? "cancel" : false;
  }
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
