import { formatNanoTON, walletQRUrl } from "../api";
import type { WalletState } from "../types";
import { Card, CopyButton, Mono, SectionTitle, Spinner } from "./ui";

/** Funding card: QR + address + live balance progress. */
export function FundingCard(props: { wallet: WalletState; compact?: boolean }) {
  const w = props.wallet;
  const balance = w.balance_nano ? BigInt(w.balance_nano) : 0n;
  const goal = BigInt(w.recommended_funding_nano || "20000000000");
  const pct = goal > 0n ? Number((balance * 100n) / goal) : 0;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 items-start justify-center">
          <img
            src={walletQRUrl()}
            alt="QR для пополнения"
            className="h-40 w-40 rounded-lg border border-ink-600 bg-white p-1.5"
            draggable={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <SectionTitle>Пополните кошелёк</SectionTitle>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
            Отправьте <span className="font-semibold text-fg">{w.recommended_funding_ton} TON</span> на
            адрес ниже. Средства пойдут на стейк платёжного канала и оплату
            запросов — остаток можно вывести в любой момент.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2">
            <Mono className="min-w-0 flex-1 truncate">{w.fund_address}</Mono>
            <CopyButton text={w.fund_address} label="Копировать" className="shrink-0" />
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-fg-muted">Баланс</span>
              <span className="font-medium">
                {w.balance_error ? (
                  <span className="inline-flex items-center gap-1.5 text-fg-faint">
                    <Spinner className="h-3 w-3" /> проверяем…
                  </span>
                ) : (
                  <>
                    {formatNanoTON(w.balance_nano)} <span className="text-fg-muted">/ {w.recommended_funding_ton} TON</span>
                  </>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-accent-500 transition-all duration-700"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-fg-faint">
              Баланс обновляется автоматически — обычно в течение минуты после отправки.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
