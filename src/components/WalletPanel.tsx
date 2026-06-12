import { useState } from "react";
import { channelRequest, formatNanoTON, getBackup, shortAddress } from "../api";
import type { AppState, RunnerStats, WalletBackup } from "../types";
import { BackupReveal } from "./Onboarding";
import { FundingCard } from "./Funding";
import { Button, Card, CopyButton, ErrorNote, Mono, Pill, SectionTitle } from "./ui";

type Props = {
  state: AppState | null;
  stats: RunnerStats | null;
};

const channelStateName = (s: number) =>
  s === 0 ? "активен" : s === 1 ? "закрывается" : s === 2 ? "закрыт" : `состояние ${s}`;

export function WalletPanel(props: Props) {
  const wallet = props.state?.wallet;
  const [backup, setBackup] = useState<WalletBackup | null>(null);
  const [backupErr, setBackupErr] = useState<string | null>(null);

  if (backup) {
    return <BackupReveal backup={backup} onConfirm={() => setBackup(null)} />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-6">
        <h1 className="text-lg font-semibold">Кошелёк</h1>

        {!wallet ? (
          <Card className="p-5 text-sm text-fg-muted">Кошелёк ещё не создан.</Card>
        ) : (
          <>
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SectionTitle>Баланс Cocoon-кошелька</SectionTitle>
                  <div className="mt-1 text-3xl font-semibold tracking-tight">
                    {formatNanoTON(wallet.balance_nano)} <span className="text-lg font-medium text-fg-muted">TON</span>
                  </div>
                  {wallet.balance_error && (
                    <div className="mt-1 text-xs text-warn">баланс недоступен: {wallet.balance_error}</div>
                  )}
                </div>
                {wallet.funded !== undefined &&
                  (wallet.funded ? <Pill tone="ok">профинансирован</Pill> : <Pill tone="warn">нужно пополнение</Pill>)}
              </div>

              <div className="mt-5 grid gap-3">
                <AddressRow label="Адрес пополнения (node)" value={wallet.fund_address} />
                <AddressRow label="Owner-адрес (восстанавливается из фразы)" value={wallet.owner_address} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  kind="ghost"
                  onClick={() => {
                    setBackupErr(null);
                    getBackup().then(setBackup, (e) => setBackupErr(String(e instanceof Error ? e.message : e)));
                  }}
                >
                  Показать recovery-фразу
                </Button>
              </div>
              {backupErr && <div className="mt-3"><ErrorNote>{backupErr}</ErrorNote></div>}
            </Card>

            {wallet.funded === false && <FundingCard wallet={wallet} />}

            <ChannelsCard stats={props.stats} />
          </>
        )}
      </div>
    </div>
  );
}

function AddressRow(props: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-fg-faint">{props.label}</div>
      <div className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2">
        <Mono className="min-w-0 flex-1 truncate">{props.value}</Mono>
        <CopyButton text={props.value} className="shrink-0" />
      </div>
    </div>
  );
}

function ChannelsCard(props: { stats: RunnerStats | null }) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const channels = props.stats?.proxies ?? [];

  const run = async (verb: "topup" | "close" | "withdraw", sc: string) => {
    setBusyKey(`${verb}:${sc}`);
    setError(null);
    setNotice(null);
    try {
      await channelRequest(verb, sc);
      setNotice("Транзакция отправлена — статус обновится после подтверждения в блокчейне.");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Card className="p-5">
      <SectionTitle>Платёжные каналы</SectionTitle>
      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
        Канал — это смарт-контракт со стейком, через который оплачиваются запросы
        к прокси. «Закрыть» запрашивает возврат средств, «Вывести» доступно после
        закрытия.
      </p>

      {channels.length === 0 ? (
        <div className="mt-3 text-[13px] text-fg-faint">
          Каналов пока нет — они создаются автоматически при первом подключении к прокси.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {channels.map((ch) => (
            <div key={ch.sc_address} className="rounded-lg border border-ink-700 bg-ink-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <Mono className="truncate">{shortAddress(ch.sc_address, 10, 8)}</Mono>
                <Pill tone={ch.state === 0 ? "ok" : ch.state === 1 ? "warn" : "muted"}>
                  {channelStateName(ch.state)}
                </Pill>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] text-fg-muted sm:grid-cols-4">
                <Stat label="использовано" value={ch.tokens_used_proxy_committed_to_db.toLocaleString()} />
                <Stat label="лимит" value={ch.tokens_used_proxy_max.toLocaleString()} />
                <Stat label="списано" value={ch.tokens_charged.toLocaleString()} />
                <Stat label="оплачено" value={ch.tokens_payed.toLocaleString()} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  kind="ghost"
                  className="!px-3 !py-1.5 text-xs"
                  busy={busyKey === `topup:${ch.sc_address}`}
                  onClick={() => void run("topup", ch.sc_address)}
                >
                  Пополнить (+1 TON)
                </Button>
                <Button
                  kind="ghost"
                  className="!px-3 !py-1.5 text-xs"
                  busy={busyKey === `close:${ch.sc_address}`}
                  onClick={() => void run("close", ch.sc_address)}
                >
                  Закрыть канал
                </Button>
                <Button
                  kind="ghost"
                  className="!px-3 !py-1.5 text-xs"
                  busy={busyKey === `withdraw:${ch.sc_address}`}
                  onClick={() => void run("withdraw", ch.sc_address)}
                >
                  Вывести
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {notice && <div className="mt-3 text-[13px] text-ok">{notice}</div>}
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
    </Card>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-fg-faint">{props.label}</div>
      <div className="font-mono text-fg">{props.value}</div>
    </div>
  );
}
