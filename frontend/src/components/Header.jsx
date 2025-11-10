import PropTypes from 'prop-types'

import ThemeToggle from './ThemeToggle'

export default function Header({ onToggleSidebar, isSidebarOpen, activeView, onSelectView, onThemeChange }) {
  const viewButtonClass = (view) =>
    `rounded-full px-3 py-1 text-sm font-medium transition ${
      activeView === view
        ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
    }`

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-gray-300 bg-gray-200 px-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded p-2 hover:bg-gray-300 dark:hover:bg-gray-700 md:hidden"
          aria-label="Toggle sidebar"
          aria-expanded={isSidebarOpen}
          onClick={onToggleSidebar}
        >
          ☰
        </button>
        <span className="text-sm font-semibold uppercase tracking-wide">Synapse</span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" className={viewButtonClass('workspace')} onClick={() => onSelectView?.('workspace')}>
            Workspace
          </button>
          <button type="button" className={viewButtonClass('config')} onClick={() => onSelectView?.('config')}>
            Settings
          </button>
        </div>
        <ThemeToggle onChange={onThemeChange} />
      </div>
    </header>
  )
}

Header.propTypes = {
  onToggleSidebar: PropTypes.func,
  isSidebarOpen: PropTypes.bool,
  activeView: PropTypes.string,
  onSelectView: PropTypes.func,
  onThemeChange: PropTypes.func,
}

Header.defaultProps = {
  onToggleSidebar: undefined,
  isSidebarOpen: true,
  activeView: 'workspace',
  onSelectView: undefined,
  onThemeChange: undefined,
}
