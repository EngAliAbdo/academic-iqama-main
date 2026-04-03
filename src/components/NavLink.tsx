import { forwardRef, type ReactNode } from "react";
import { NavLink as RouterNavLink, type NavLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavLinkRenderState {
  isActive: boolean;
  isPending: boolean;
}

interface NavLinkCompatProps extends Omit<NavLinkProps, "children" | "className"> {
  children?: ReactNode | ((state: NavLinkRenderState) => ReactNode);
  className?: string | ((state: NavLinkRenderState) => string);
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ children, className, activeClassName, pendingClassName, to, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={(state) =>
          cn(
            typeof className === "function" ? className(state) : className,
            state.isActive && activeClassName,
            state.isPending && pendingClassName,
          )
        }
        {...props}
      >
        {(state) => (typeof children === "function" ? children(state) : children)}
      </RouterNavLink>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
