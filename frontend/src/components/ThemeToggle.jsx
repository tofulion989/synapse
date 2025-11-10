import { useEffect, useState } from 'react'

export default function ThemeToggle({ onChange }) {
  const getStoredTheme = () =>
    (typeof window !== 'undefined' && localStorage.getItem('theme')) || 'light'

  const [theme, setTheme] = useState(getStoredTheme())

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', nextTheme)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', nextTheme)
      document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    }
    onChange?.(nextTheme)
  }

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full bg-gray-200 px-3 py-2 text-sm transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}
