import { useState } from "react";
import { channelRequest, formatNanoTON, getBackup, shortAddress } from "../api";
import type { AppState, ChannelState, ProxyChannel, RunnerStats, WalletBackup } from "../types";
import { BackupReveal } from "./Onboarding";
import { FundingCard } from "./Funding";
import { Button, Card, CopyButton, ErrorNote, Mono, Pill, SectionTitle } from "./ui";

type Props = {
  state: AppState | null;
  stats: RunnerStats | null;
};

const channelStateName = (s: number) =>
  s === 0 ? "активен" : s === 1 ? "закрывается" : s === 2 ? "закрыт" : `состояние ${s}`;

function canWithdrawSurplus(ch?: ChannelState): boolean {
  if (!ch?.active) return false;
  try {
    return BigInt(ch.balance_nano) > BigInt(ch.stake_nano);
  } catch {
    return false;
  }
}

function explainChannelError(err: unknown): string {
  const msg = String(err instanceof Error ? err.message : err);
  if (msg.includes("1001")) {
    return "Контракт вернул 1001: свободного остатка для вывода нет или смарт-контракту не хватает TON на комиссию. Если баланс канала равен стейку, сначала закрывайте канал, а не снимайте излишек.";
  }
  if (msg.includes("1011")) {
    return "Контракт вернул 1011: канал еще не разблокирован для финального возврата. Нужно подождать delay закрытия и нажать завершение возврата позже.";
  }
  if (msg.includes("1006")) {
    return "Контракт вернул 1006: операция недоступна для текущего состояния канала.";
  }
  return msg;
}

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
        <h1 className="text-lg font-semibold">Кошелек</h1>

        {!wallet ? (
          <Card className="p-5 text-sm text-fg-muted">Кошелек еще не создан.</Card>
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
                {wallet.channel?.active ? (
                  <Pill tone="ok">канал открыт</Pill>
                ) : wallet.funded !== undefined ? (
                  wallet.funded ? (
                    <Pill tone="ok">профинансирован</Pill>
                  ) : (
                    <Pill tone="warn">нужно пополнение</Pill>
                  )
                ) : null}
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
              {backupErr && (
                <div className="mt-3">
                  <ErrorNote>{backupErr}</ErrorNote>
                </div>
              )}
            </Card>

            {wallet.funded === false && !wallet.channel?.active && <FundingCard wallet={wallet} />}

            <ChannelsCard stats={props.stats} stateChannel={wallet.channel} />
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

function ChannelsCard(props: { stats: RunnerStats | null; stateChannel?: ChannelState }) {
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
      setNotice("Транзакция отправлена. Статус обновится после подтверждения в блокчейне.");
    } catch (e) {
      setError(explainChannelError(e));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Card className="p-5">
      <SectionTitle>Платежные каналы</SectionTitle>
      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
        Канал держит стейк и оплачивает запросы к прокси. «Снять излишек» работает только когда баланс канала выше
        стейка. Для возврата стейка сначала закройте канал, затем после задержки завершите возврат.
      </p>

      {channels.length === 0 && props.stateChannel ? (
        <ChannelCard
          address={props.stateChannel.address}
          stateChannel={props.stateChannel}
          busyKey={busyKey}
          onRun={run}
        />
      ) : channels.length === 0 ? (
        <div className="mt-3 text-[13px] text-fg-faint">
          Каналов пока нет. Они создаются автоматически при первом подключении к прокси.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {channels.map((ch, index) => (
            <ChannelCard
              key={ch.sc_address}
              address={ch.sc_address}
              proxyChannel={ch}
              stateChannel={index === 0 ? props.stateChannel : undefined}
              busyKey={busyKey}
              onRun={run}
            />
          ))}
        </div>
      )}
      {notice && <div className="mt-3 text-[13px] text-ok">{notice}</div>}
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </Card>
  );
}

function ChannelCard(props: {
  address: string;
  proxyChannel?: ProxyChannel;
  stateChannel?: ChannelState;
  busyKey: string | null;
  onRun: (verb: "topup" | "close" | "withdraw", sc: string) => Promise<void>;
}) {
  const state = props.stateChannel
    ? props.stateChannel.active
      ? 0
      : props.stateChannel.state === "closing"
        ? 1
        : props.stateChannel.state === "closed"
          ? 2
          : props.proxyChannel?.state ?? 0
    : props.proxyChannel?.state ?? 0;
  const withdrawable = canWithdrawSurplus(props.stateChannel);
  const closeLabel = state === 1 ? "Завершить возврат" : "Закрыть канал";

  return (
    <div className="mt-4 rounded-lg border border-ink-700 bg-ink-900 p-4 first:mt-0">
      <div className="flex items-center justify-between gap-3">
        <Mono className="truncate">{shortAddress(props.address, 10, 8)}</Mono>
        <Pill tone={state === 0 ? "ok" : state === 1 ? "warn" : "muted"}>{channelStateName(state)}</Pill>
      </div>

      {props.stateChannel ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] text-fg-muted sm:grid-cols-3">
            <Stat label="баланс канала" value={`${props.stateChannel.balance_ton} TON`} />
            <Stat label="стейк" value={`${props.stateChannel.stake_ton} TON`} />
            <Stat label="израсходовано токенов" value={props.stateChannel.tokens_used.toLocaleString()} />
          </div>
          {!withdrawable && state === 0 && (
            <p className="mt-3 text-xs text-fg-faint">
              Свободного остатка нет: баланс канала равен стейку. Чтобы вернуть стейк, используйте закрытие канала.
            </p>
          )}
        </>
      ) : props.proxyChannel ? (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] text-fg-muted sm:grid-cols-4">
          <Stat label="использовано" value={props.proxyChannel.tokens_used_proxy_committed_to_db.toLocaleString()} />
          <Stat label="лимит" value={props.proxyChannel.tokens_used_proxy_max.toLocaleString()} />
          <Stat label="списано" value={props.proxyChannel.tokens_charged.toLocaleString()} />
          <Stat label="оплачено" value={props.proxyChannel.tokens_payed.toLocaleString()} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          kind="ghost"
          className="!px-3 !py-1.5 text-xs"
          disabled={state !== 0}
          busy={props.busyKey === `topup:${props.address}`}
          onClick={() => void props.onRun("topup", props.address)}
        >
          Пополнить (+1 TON)
        </Button>
        <Button
          kind="ghost"
          className="!px-3 !py-1.5 text-xs"
          disabled={state === 2}
          busy={props.busyKey === `close:${props.address}`}
          onClick={() => void props.onRun("close", props.address)}
        >
          {closeLabel}
        </Button>
        <Button
          kind="ghost"
          className="!px-3 !py-1.5 text-xs"
          disabled={!withdrawable}
          title={withdrawable ? "Снять баланс сверх стейка" : "Нет свободного остатка сверх стейка"}
          busy={props.busyKey === `withdraw:${props.address}`}
          onClick={() => void props.onRun("withdraw", props.address)}
        >
          Снять излишек
        </Button>
      </div>
    </div>
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
