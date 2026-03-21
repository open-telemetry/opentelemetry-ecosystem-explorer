/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useEffect } from "react";
import { useSdkOptions } from "@/hooks/use-sdk-options";
import { useConfigurationBuilder } from "../hooks/use-configuration-builder";
import type { SdkConfig } from "@/types/sdk";

export function SdkBrowser() {
  const { state, dispatch } = useConfigurationBuilder();
  const { data: options, loading } = useSdkOptions();
  const sdk = state.sdkConfig;

  // Initialize state from sdk-options.json defaults on first load
  useEffect(() => {
    if (!options) return;
    const d = options.defaults;
    const sdkConfig: SdkConfig = {
      fileFormat: d.file_format,
      propagators: [...d.propagators],
      tracerProvider: {
        exporterType: d.tracer_provider.exporter_type,
        exporterEndpoint:
          d.tracer_provider.exporters[d.tracer_provider.exporter_type]?.endpoint ?? "",
        exporterProtocol:
          d.tracer_provider.exporters[d.tracer_provider.exporter_type]?.protocol ?? "",
        samplerType: d.tracer_provider.sampler.type,
        samplerRoot: d.tracer_provider.sampler.root,
        samplerRatio: d.tracer_provider.sampler.ratio,
        batchScheduleDelay: d.tracer_provider.batch_processor.schedule_delay,
        batchExportTimeout: d.tracer_provider.batch_processor.export_timeout,
        batchMaxQueueSize: d.tracer_provider.batch_processor.max_queue_size,
        batchMaxExportBatchSize: d.tracer_provider.batch_processor.max_export_batch_size,
      },
    };
    dispatch({ type: "LOAD_SDK_DEFAULTS", sdkConfig });
  }, [options, dispatch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading SDK options...</div>
      </div>
    );
  }

  if (!options) {
    return <div className="text-sm text-destructive py-4">Failed to load SDK options.</div>;
  }

  const { sections } = options;
  const tracerSection = sections.tracer_provider;

  const handleExporterTypeChange = (exporterType: string) => {
    dispatch({ type: "SET_SDK_EXPORTER_TYPE", exporterType });
    const exporterDefaults = options.defaults.tracer_provider.exporters[exporterType] ?? {};
    dispatch({ type: "SET_SDK_EXPORTER_ENDPOINT", endpoint: exporterDefaults.endpoint ?? "" });
    dispatch({ type: "SET_SDK_EXPORTER_PROTOCOL", protocol: exporterDefaults.protocol ?? "" });
  };

  return (
    <div className="space-y-6">
      {/* Propagators */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{sections.propagators.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{sections.propagators.description}</p>
        </div>
        <div className="space-y-2">
          {sections.propagators.options.map((opt) => (
            <label key={opt.id} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={sdk.propagators.includes(opt.id)}
                onChange={() => dispatch({ type: "TOGGLE_SDK_PROPAGATOR", propagatorId: opt.id })}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
              />
              <div>
                <div className="text-sm font-medium text-foreground group-hover:text-primary">
                  {opt.name}
                </div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <hr className="border-border" />

      {/* Exporter */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{tracerSection.exporter.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tracerSection.exporter.description}
          </p>
        </div>
        <div className="space-y-2">
          {tracerSection.exporter.options.map((opt) => (
            <label key={opt.id} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="exporter-type"
                value={opt.id}
                checked={sdk.tracerProvider.exporterType === opt.id}
                onChange={() => handleExporterTypeChange(opt.id)}
                className="mt-0.5 h-4 w-4 border-border text-primary focus:ring-2 focus:ring-primary"
              />
              <div>
                <div className="text-sm font-medium text-foreground group-hover:text-primary">
                  {opt.name}
                </div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Exporter endpoint field */}
        {sdk.tracerProvider.exporterType !== "console" && (
          <div className="ml-7 space-y-2 pt-1">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Endpoint URL</label>
              <input
                type="text"
                value={sdk.tracerProvider.exporterEndpoint}
                onChange={(e) =>
                  dispatch({ type: "SET_SDK_EXPORTER_ENDPOINT", endpoint: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="http://localhost:4318"
              />
            </div>
            {sdk.tracerProvider.exporterType === "otlp_http" && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Protocol</label>
                <select
                  value={sdk.tracerProvider.exporterProtocol}
                  onChange={(e) =>
                    dispatch({ type: "SET_SDK_EXPORTER_PROTOCOL", protocol: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="http/protobuf">http/protobuf</option>
                  <option value="http/json">http/json</option>
                </select>
              </div>
            )}
          </div>
        )}
      </section>

      <hr className="border-border" />

      {/* Sampler */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{tracerSection.sampler.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tracerSection.sampler.description}
          </p>
        </div>
        <div className="space-y-2">
          {tracerSection.sampler.options.map((opt) => (
            <label key={opt.id} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="sampler-type"
                value={opt.id}
                checked={sdk.tracerProvider.samplerType === opt.id}
                onChange={() => dispatch({ type: "SET_SDK_SAMPLER_TYPE", samplerType: opt.id })}
                className="mt-0.5 h-4 w-4 border-border text-primary focus:ring-2 focus:ring-primary"
              />
              <div>
                <div className="text-sm font-medium text-foreground group-hover:text-primary">
                  {opt.name}
                </div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Parent-based root sampler */}
        {sdk.tracerProvider.samplerType === "parent_based" && (
          <div className="ml-7 pt-1">
            <label className="block text-xs font-medium text-foreground mb-1">Root sampler</label>
            <select
              value={sdk.tracerProvider.samplerRoot}
              onChange={(e) => dispatch({ type: "SET_SDK_SAMPLER_ROOT", root: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {tracerSection.sampler.options
                .find((o) => o.id === "parent_based")
                ?.root_options?.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
            </select>
            {sdk.tracerProvider.samplerRoot === "trace_id_ratio_based" && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-foreground mb-1">
                  Sampling ratio (0.0 – 1.0)
                </label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={sdk.tracerProvider.samplerRatio}
                  onChange={(e) =>
                    dispatch({ type: "SET_SDK_SAMPLER_RATIO", ratio: parseFloat(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )}

        {/* Standalone ratio sampler */}
        {sdk.tracerProvider.samplerType === "trace_id_ratio_based" && (
          <div className="ml-7 pt-1">
            <label className="block text-xs font-medium text-foreground mb-1">
              Sampling ratio (0.0 – 1.0)
            </label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={sdk.tracerProvider.samplerRatio}
              onChange={(e) =>
                dispatch({ type: "SET_SDK_SAMPLER_RATIO", ratio: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
      </section>

      <hr className="border-border" />

      {/* Batch Processor */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {tracerSection.batch_processor.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tracerSection.batch_processor.description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tracerSection.batch_processor.settings.map((setting) => {
            const stateKey = (
              {
                schedule_delay: "batchScheduleDelay",
                export_timeout: "batchExportTimeout",
                max_queue_size: "batchMaxQueueSize",
                max_export_batch_size: "batchMaxExportBatchSize",
              } as Record<string, keyof typeof sdk.tracerProvider>
            )[setting.name];

            if (!stateKey) return null;

            return (
              <div key={setting.name}>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {setting.label}
                </label>
                <input
                  type="number"
                  min={setting.min}
                  value={sdk.tracerProvider[stateKey] as number}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_SDK_BATCH_SETTING",
                      key: stateKey,
                      value: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
