import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SlashCommandItem, SlashCommandTrigger } from '../types/slashCommand';
import {
  filterSlashCommands,
  findSlashTrigger,
  normalizeSlashCommands,
  replaceSlashTrigger,
} from '../utils/slashCommand';
import { readSlashCommandStore, writeSlashCommandStore } from '../utils/slashCommandStore';
import { reportSlashCommandPanelTrigger, reportSlashCommandSelect } from '../utils/uemUtil';

const REQUEST_THROTTLE_MS = 1000;
const FAILED_COOLDOWN_MS = 3000;
const inFlightRequests = new Map<string, Promise<void>>();
const lastRequestAt = new Map<string, number>();
const failedAt = new Map<string, number>();

export function clearSlashCommandSuggestStateForTest(): void {
  inFlightRequests.clear();
  lastRequestAt.clear();
  failedAt.clear();
}

export interface UseSlashCommandSuggestOptions {
  partnerAccount?: string;
  isPcMiniApp?: boolean;
  slashCommands?: SlashCommandItem[];
  onRequestCommands?: () => Promise<void> | void;
}

interface SelectSlashCommandResult {
  value: string;
}

export function useSlashCommandSuggest(options: UseSlashCommandSuggestOptions) {
  const partnerAccount = options.partnerAccount?.trim() ?? '';
  const isPcMiniApp = Boolean(options.isPcMiniApp);
  const slashCommands = options.slashCommands;
  const onRequestCommands = options.onRequestCommands;
  const [commands, setCommands] = useState<SlashCommandItem[]>([]);
  const [commandSource, setCommandSource] = useState<'storage' | 'db' | 'memory' | 'websocket'>('websocket');
  const [trigger, setTrigger] = useState<SlashCommandTrigger | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const fallbackReadTriedRef = useRef(false);

  const filteredCommands = useMemo(
    () => (trigger ? filterSlashCommands(commands, trigger.query) : []),
    [commands, trigger],
  );
  const isOpen = Boolean(trigger && filteredCommands.length > 0);

  useEffect(() => {
    const nextCommands = normalizeSlashCommands(slashCommands ?? []);
    if (!partnerAccount || !slashCommands) {
      return;
    }
    fallbackReadTriedRef.current = false;
    failedAt.delete(partnerAccount);
    setCommandSource('websocket');
    setCommands(nextCommands);
    void writeSlashCommandStore({ partnerAccount, isPcMiniApp, commands: nextCommands });
  }, [isPcMiniApp, slashCommands, partnerAccount]);

  const loadCommands = useCallback(async () => {
    if (!partnerAccount) {
      return [];
    }

    if (commands.length > 0) {
      return commands;
    }

    const storedCommands = await readSlashCommandStore({ partnerAccount, isPcMiniApp });
    if (storedCommands) {
      setCommandSource(isPcMiniApp ? 'db' : 'storage');
      setCommands(storedCommands);
      return storedCommands;
    }

    if (!onRequestCommands) {
      return [];
    }

    const now = Date.now();
    const existingRequest = inFlightRequests.get(partnerAccount);
    if (existingRequest) {
      await existingRequest;
      return commands;
    }

    const previousRequestAt = lastRequestAt.get(partnerAccount) ?? 0;
    const previousFailedAt = failedAt.get(partnerAccount) ?? 0;
    if (now - previousRequestAt < REQUEST_THROTTLE_MS || now - previousFailedAt < FAILED_COOLDOWN_MS) {
      return commands;
    }

    const request = Promise.resolve(onRequestCommands());
    inFlightRequests.set(partnerAccount, request);
    lastRequestAt.set(partnerAccount, now);

    try {
      await request;
      failedAt.delete(partnerAccount);
      fallbackReadTriedRef.current = false;
      return commands;
    } catch (_error) {
      failedAt.set(partnerAccount, Date.now());
      if (!fallbackReadTriedRef.current) {
        fallbackReadTriedRef.current = true;
        const fallbackCommands = await readSlashCommandStore({
          partnerAccount,
          isPcMiniApp,
          ignoreExpiry: true,
        });
        if (fallbackCommands) {
          setCommandSource(isPcMiniApp ? 'db' : 'storage');
          setCommands(fallbackCommands);
          return fallbackCommands;
        }
      }
      return [];
    } finally {
      inFlightRequests.delete(partnerAccount);
    }
  }, [commands, isPcMiniApp, onRequestCommands, partnerAccount]);

  const handleValueChange = useCallback((value: string, cursor: number) => {
    const nextTrigger = findSlashTrigger(value, cursor);
    setTrigger(nextTrigger);
    if (!nextTrigger) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex(nextTrigger.query ? 0 : -1);
    void loadCommands();
  }, [loadCommands]);

  const previousOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !previousOpenRef.current) {
      reportSlashCommandPanelTrigger({
        partnerAccount,
        commandCount: filteredCommands.length,
        source: commandSource,
        isPcMiniApp,
      });
    }
    previousOpenRef.current = isOpen;
  }, [commandSource, filteredCommands.length, isOpen, isPcMiniApp, partnerAccount]);

  const close = useCallback(() => {
    setTrigger(null);
    setHighlightedIndex(-1);
  }, []);

  const moveHighlight = useCallback((delta: number) => {
    setHighlightedIndex((currentIndex) => {
      if (filteredCommands.length === 0) {
        return -1;
      }
      const baseIndex = currentIndex < 0 ? 0 : currentIndex;
      return (baseIndex + delta + filteredCommands.length) % filteredCommands.length;
    });
  }, [filteredCommands.length]);

  const selectCommand = useCallback((value: string, command?: SlashCommandItem): SelectSlashCommandResult | null => {
    if (!trigger) {
      return null;
    }
    const selectedCommand = command ?? (highlightedIndex >= 0 ? filteredCommands[highlightedIndex] : undefined);
    if (!selectedCommand) {
      return null;
    }
    const nextValue = replaceSlashTrigger(value, trigger, selectedCommand.command);
    reportSlashCommandSelect({
      partnerAccount,
      command: selectedCommand.command,
      queryLength: trigger.query.length,
      selectMethod: command ? 'click' : 'enter',
      isPcMiniApp,
    });
    close();
    return { value: nextValue };
  }, [close, filteredCommands, highlightedIndex, isPcMiniApp, partnerAccount, trigger]);

  return {
    commands,
    filteredCommands,
    highlightedIndex,
    isOpen,
    trigger,
    close,
    handleValueChange,
    moveHighlight,
    selectCommand,
  };
}
