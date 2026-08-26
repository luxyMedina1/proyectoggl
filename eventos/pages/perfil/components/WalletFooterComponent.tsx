type WalletFooterProps = {
  onGoogleClick?: () => void;
  onAppleClick?: () => void;
  googleDisabled?: boolean;
  appleDisabled?: boolean;
};

export function WalletFooter({
  onGoogleClick,
  onAppleClick,
  googleDisabled = false,
  appleDisabled = false,
}: WalletFooterProps) {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="grid grid-cols-2 gap-3">
            {/* Google */}
            <button
              type="button"
              onClick={onGoogleClick}
              disabled={googleDisabled}
              className={[
                "group inline-flex items-center justify-center rounded-xl border bg-white px-3 py-2",
                "shadow-sm transition hover:shadow-md active:scale-[0.99]",
                "focus:outline-none focus:ring-2 focus:ring-black/20",
                googleDisabled ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              aria-label="Agregar a Google Wallet"
            >
              <img
                src="/Google_Wallet_icon.svg"
                alt="Agregar a Google Wallet"
                className="h-10 w-auto select-none"
                draggable={false}
              />
            </button>

            {/* Apple */}
            <button
              type="button"
              onClick={onAppleClick}
              disabled={appleDisabled}
              className={[
                "group inline-flex items-center justify-center rounded-xl border bg-white px-3 py-2",
                "shadow-sm transition hover:shadow-md active:scale-[0.99]",
                "focus:outline-none focus:ring-2 focus:ring-black/20",
                appleDisabled  ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              aria-label="Agregar a Apple Wallet"
            >
              <img
                src="/Apple_Wallet_Icon.svg"
                alt="Agregar a Apple Wallet"
                className="h-full w-full select-none"
                draggable={false}
              />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
