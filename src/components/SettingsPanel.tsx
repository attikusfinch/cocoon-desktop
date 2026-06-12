import { isTauri } from "../platform";
import type { AppState, SidecarStatus } from "../types";
import { Card, CopyButton, Mono, SectionTitle } from "./ui";

type Props = {
  state: AppState | null;
  sidecar: SidecarStatus | null;
};

export function SettingsPanel(props: Props) {
  const paths = props.state?.paths;
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-6">
        <h1 className="text-lg font-semibold">Настройки</h1>

        <Card className="p-5">
          <SectionTitle>Файлы и данные</SectionTitle>
          <div className="mt-3 grid gap-2.5">
            <PathRow label="Каталог данных" value={paths?.data_dir} />
            <PathRow label="Кошелёк" value={paths?.wallet_path} />
            <PathRow label="Конфиг ядра" value={paths?.config_path} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-fg-faint">
            История чатов хранится локально в каталоге данных и не покидает это
            устройство.
          </p>
        </Card>

        <Card className="p-5">
          <SectionTitle>О приложении</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[13px]">
            <span className="text-fg-muted">Ядро gocoon</span>
            <span className="selectable">
              {props.state?.version.version ?? "—"}{" "}
              <span className="text-fg-faint">({props.state?.version.commit ?? "—"})</span>
            </span>
            <span className="text-fg-muted">Режим</span>
            <span>{isTauri ? "десктоп (Tauri)" : "браузер (dev)"}</span>
            <span className="text-fg-muted">API ядра</span>
            <span className="selectable font-mono text-[12px]">{props.sidecar?.runnerUrl ?? "http://127.0.0.1:10000"}</span>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Сеть Cocoon</SectionTitle>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
            Cocoon — открытая сеть конфиденциальных вычислений на TON. Запросы
            шифруются end-to-end и выполняются внутри TEE-анклавов; владельцы
            GPU не видят ни промптов, ни ответов. Оплата идёт за фактически
            использованные токены через платёжные каналы.
          </p>
        </Card>
      </div>
    </div>
  );
}

function PathRow(props: { label: string; value?: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-fg-faint">{props.label}</div>
      <div className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-1.5">
        <Mono className="min-w-0 flex-1 truncate">{props.value ?? "—"}</Mono>
        {props.value && <CopyButton text={props.value} className="shrink-0" />}
      </div>
    </div>
  );
}
