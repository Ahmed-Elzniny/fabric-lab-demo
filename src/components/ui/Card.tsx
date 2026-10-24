// src/components/ui/Card.tsx
import type { ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  "aria-label"?: string;
}

export function Card({ title, subtitle, icon, actions, footer, className = "", bodyClassName = "", children, ...rest }: CardProps) {
  return (
    <section className={`card ${className}`} aria-label={rest["aria-label"]}>
      {(title || actions) && (
        <header className="card__head">
          <div className="card__title">
            {icon && (
              <span className="card__icon" aria-hidden="true">
                {icon}
              </span>
            )}
            <div>
              {title && <h3>{title}</h3>}
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          {actions}
        </header>
      )}
      <div className={`card__body ${bodyClassName}`}>{children}</div>
      {footer && <footer className="card__foot">{footer}</footer>}
    </section>
  );
}
