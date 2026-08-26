"use client";

import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
} from "next/navigation";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className"> &
  Omit<NextLinkProps, "href"> & {
    to?: string;
    href?: string;
    children?: ReactNode;
    className?: string | ((args: { isActive: boolean }) => string);
  };

const resolveHref = (href?: string, to?: string) => href ?? to ?? "/";

export function Link({ to, href, className, ...props }: LinkProps) {
  const pathname = usePathname();
  const target = resolveHref(href, to);
  const computedClassName =
    typeof className === "function" ? className({ isActive: pathname === target }) : className;

  return <NextLink href={target} className={computedClassName} {...props} />;
}

export function NavLink(props: LinkProps) {
  return <Link {...props} />;
}

export function useNavigate() {
  const router = useRouter();

  return (to: string | number, options?: { replace?: boolean; state?: unknown }) => {
    if (typeof to === "number") {
      window.history.go(to);
      return;
    }

    if (typeof window !== "undefined" && options?.state !== undefined) {
      window.history.replaceState({ ...(window.history.state ?? {}), usr: options.state }, "");
    }

    if (options?.replace) {
      router.replace(to);
    } else {
      router.push(to);
    }
  };
}

export function useParams<T extends Record<string, string | string[] | undefined> = Record<string, string>>() {
  return useNextParams<T>();
}

export function useLocation() {
  const pathname = usePathname();
  const search = typeof window !== "undefined" ? window.location.search : "";

  return {
    pathname,
    search,
    hash: typeof window !== "undefined" ? window.location.hash : "",
    state: typeof window !== "undefined" ? window.history.state?.usr ?? null : null,
  };
}

export function useSearchParams(): [URLSearchParams, (params: URLSearchParams | string, options?: { replace?: boolean }) => void] {
  const router = useRouter();
  const pathname = usePathname();

  const setSearchParams = (nextParams: URLSearchParams | string, options?: { replace?: boolean }) => {
    const query = nextParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (options?.replace) {
      router.replace(url);
    } else {
      router.push(url);
    }
  };

  const currentSearch = typeof window !== "undefined" ? window.location.search : "";
  return [new URLSearchParams(currentSearch), setSearchParams];
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  navigate(to, { replace });
  return null;
}

export function Outlet() {
  return null;
}
