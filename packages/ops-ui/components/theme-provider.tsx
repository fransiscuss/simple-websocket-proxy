"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const Provider = NextThemesProvider as React.ComponentType<ThemeProviderProps>
  return (
    <Provider {...props}>
      {children}
    </Provider>
  )
}