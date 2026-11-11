import { Bell, Bot, CalendarCheck, Home, Plug, Settings, Target, Trophy, Users, PenLine } from "lucide-react";

export const MAIN_NAV = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/goals", label: "Goals", Icon: Target },
  { href: "/log", label: "Log", Icon: PenLine },
  { href: "/coach", label: "Coach", Icon: Bot },
  { href: "/rewards", label: "Rewards", Icon: Trophy },
] as const;

export const MORE_NAV = [
  { href: "/review", label: "Weekly review", Icon: CalendarCheck },
  { href: "/partners", label: "Partners", Icon: Users },
  { href: "/integrations", label: "Integrations", Icon: Plug },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
