import { useState } from "react";
import { createWallet, importWallet } from "../api";
import type { AppState, WalletBackup } from "../types";
import { Button, Card, CopyButton, ErrorNote, Field, inputCls } from "./ui";
import logo from "../assets/egg.png";

type Props = {
  /** Runner API reachable? null = still probing. */
  online: boolean | null;
  onDone: (state: AppState, backup: WalletBackup | null) => void;
};

export function Onboarding(props: Props) {
  const [screen, setScreen] = useState<"welcome" | "import">("welcome");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await createWallet();
      props.onDone(res.state, res.backup ?? null);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    const text = importText.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const payload = text.startsWith("{") ? { backup_json: text } : { mnemonic: text };
      const res = await importWallet(payload);
      props.onDone(res.state, null);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-ink-950 p-6">
      <div className="fade-in w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="" className="mb-4 h-20 w-20" draggable={false} />
          <h1 className="text-2xl font-semibold tracking-tight">Cocoon</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
            Приватный ИИ в децентрализованной сети на TON. Запросы шифруются и
            выполняются в защищённых анклавах — их не видит никто, кроме вас.
          </p>
        </div>

        {props.online === false && (
          <Card className="mb-4 p-4">
            <div className="text-sm text-warn">
              Локальное ядро ещё запускается… Если это сообщение не исчезает,
              проверьте логи в настройках.
            </div>
          </Card>
        )}

        {screen === "welcome" ? (
          <Card className="p-6">
            <div className="flex flex-col gap-3">
              <Button onClick={() => void create()} busy={busy} disabled={props.online !== true}>
                Создать новый кошелёк
              </Button>
              <Button kind="ghost" onClick={() => setScreen("import")} disabled={busy}>
                У меня уже есть кошелёк
              </Button>
            </div>
            {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
            <p className="mt-5 text-center text-xs leading-relaxed text-fg-faint">
              Кошелёк создаётся локально и никогда не покидает это устройство.
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <Field label="24 слова recovery-фразы или полный backup JSON">
              <textarea
                className={`${inputCls} h-32 resize-none font-mono text-[12.5px]`}
                placeholder="word1 word2 … word24   или   { …backup.json }"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                spellCheck={false}
              />
            </Field>
            <p className="mt-2 text-xs leading-relaxed text-fg-faint">
              По фразе восстанавливается owner-кошелёк (адрес пополнения будет
              новым). Полный backup JSON восстанавливает всё, включая адрес
              пополнения.
            </p>
            {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
            <div className="mt-4 flex gap-3">
              <Button kind="ghost" onClick={() => setScreen("welcome")} disabled={busy}>
                Назад
              </Button>
              <Button onClick={() => void doImport()} busy={busy} className="flex-1" disabled={!importText.trim()}>
                Импортировать
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Full-screen recovery-phrase display, shown exactly once after creation. */
export function BackupReveal(props: { backup: WalletBackup; onConfirm: () => void }) {
  const [confirmed, setConfirmed] = useState(false);

  const download = () => {
    const blob = new Blob([props.backup.backup_json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cocoon-wallet-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-ink-950 p-6">
      <div className="fade-in w-full max-w-2xl">
        <h2 className="text-xl font-semibold">Сохраните recovery-фразу</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Эти 24 слова — единственный способ восстановить доступ к средствам.
          Запишите их и храните офлайн. Фраза показывается только один раз.
        </p>

        <Card className="mt-5 p-5">
          <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4">
            {props.backup.owner_mnemonic.map((word, i) => (
              <li key={i} className="flex items-baseline gap-2 font-mono text-[13px]">
                <span className="w-5 text-right text-fg-faint">{i + 1}.</span>
                <span className="selectable text-fg">{word}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton text={props.backup.owner_mnemonic_text} label="Скопировать фразу" />
            <CopyButton text={props.backup.backup_json} label="Скопировать backup JSON" />
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-ink-800 hover:text-fg"
              onClick={download}
            >
              Скачать backup JSON
            </button>
          </div>
        </Card>

        <div className="mt-5 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-[13px] leading-relaxed text-warn">
          Backup JSON содержит ещё и ключ node-кошелька — с ним восстанавливается
          точный адрес пополнения. Храните его так же бережно, как фразу.
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="h-4 w-4 accent-gold-500"
          />
          Я сохранил(а) фразу в надёжном месте
        </label>

        <Button className="mt-4 w-full" disabled={!confirmed} onClick={props.onConfirm}>
          Продолжить
        </Button>
      </div>
    </div>
  );
}
