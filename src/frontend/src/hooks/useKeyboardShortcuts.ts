import { useEffect, useCallback } from 'react';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  category: string;
}

/**
 * Keyboard Shortcuts Hook
 * Manages global keyboard shortcuts
 */
export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[]) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key, ctrlKey, shiftKey, altKey } = event;

      for (const shortcut of shortcuts) {
        const matches =
          key.toLowerCase() === shortcut.key.toLowerCase() &&
          (shortcut.ctrl === undefined || shortcut.ctrl === ctrlKey) &&
          (shortcut.shift === undefined || shortcut.shift === shiftKey) &&
          (shortcut.alt === undefined || shortcut.alt === altKey);

        if (matches) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

/**
 * Default application shortcuts
 */
export const getDefaultShortcuts = (actions: {
  openSearch?: () => void;
  openHelp?: () => void;
  toggleTheme?: () => void;
  refresh?: () => void;
  openSettings?: () => void;
  createNew?: () => void;
  deleteSelected?: () => void;
  save?: () => void;
  cancel?: () => void;
}): ShortcutConfig[] => {
  return [
    {
      key: 'k',
      ctrl: true,
      action: actions.openSearch || (() => {}),
      description: '打开搜索',
      category: '导航',
    },
    {
      key: 'h',
      ctrl: true,
      action: actions.openHelp || (() => {}),
      description: '打开快捷键帮助',
      category: '帮助',
    },
    {
      key: 'd',
      ctrl: true,
      action: actions.toggleTheme || (() => {}),
      description: '切换主题',
      category: '视图',
    },
    {
      key: 'r',
      ctrl: true,
      action: actions.refresh || (() => {}),
      description: '刷新页面',
      category: '导航',
    },
    {
      key: ',',
      ctrl: true,
      action: actions.openSettings || (() => {}),
      description: '打开设置',
      category: '导航',
    },
    {
      key: 'n',
      ctrl: true,
      action: actions.createNew || (() => {}),
      description: '新建',
      category: '操作',
    },
    {
      key: 'Delete',
      action: actions.deleteSelected || (() => {}),
      description: '删除选中项',
      category: '操作',
    },
    {
      key: 's',
      ctrl: true,
      action: actions.save || (() => {}),
      description: '保存',
      category: '操作',
    },
    {
      key: 'Escape',
      action: actions.cancel || (() => {}),
      description: '取消/关闭',
      category: '操作',
    },
  ];
};

export default useKeyboardShortcuts;
