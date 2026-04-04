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
import * as RadixTabs from "@radix-ui/react-tabs";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";

const Tabs = RadixTabs.Root;

const TabsList = forwardRef<
  ComponentRef<typeof RadixTabs.List>,
  ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className = "", ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={`inline-flex h-12 items-center justify-center rounded-lg border border-border/50 bg-card/80 p-1 ${className}`}
    {...props}
  />
));
TabsList.displayName = RadixTabs.List.displayName;

const TabsTrigger = forwardRef<
  ComponentRef<typeof RadixTabs.Trigger>,
  ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className = "", ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-md border-t border-transparent px-6 py-3 text-sm font-medium text-muted-foreground ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:text-foreground hover:bg-card-secondary/60 data-[state=active]:border-primary data-[state=active]:bg-card-secondary data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[0_2px_12px_-2px_hsl(var(--primary-hsl)/0.4)] ${className}`}
    {...props}
  />
));
TabsTrigger.displayName = RadixTabs.Trigger.displayName;

const TabsContent = forwardRef<
  ComponentRef<typeof RadixTabs.Content>,
  ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className = "", ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
    {...props}
  />
));
TabsContent.displayName = RadixTabs.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
