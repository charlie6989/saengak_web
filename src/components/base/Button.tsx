
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** 
   * Click handler – receives the native mouse event for flexibility.
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  href?: string;
}

/**
 * A versatile button component that renders either an <a> tag (when `href` is provided)
 * or a <button> element. It supports three visual variants and three sizes.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  href,
}: ButtonProps) {
  // Base utility classes shared by both <a> and <button>.
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-colors whitespace-nowrap cursor-pointer';

  // Variant‑specific Tailwind classes.
  const variants: Record<ButtonProps['variant'], string> = {
    primary: 'text-white hover:opacity-90',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    outline: 'border text-gray-700 hover:bg-gray-50',
  };

  // Size‑specific Tailwind classes.
  const sizes: Record<ButtonProps['size'], string> = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  // Combine everything into a single class string.
  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`.trim();

  // Inline style tweaks that depend on the selected variant.
  const style: React.CSSProperties = {
    fontFamily: 'Noto Sans TC, sans-serif',
    ...(variant === 'primary' && { backgroundColor: '#245B50' }),
    ...(variant === 'outline' && { borderColor: '#245B50', color: '#245B50' }),
  };

  // Defensive check – if both `href` and `onClick` are supplied we prefer navigation,
  // but log a warning to help developers catch unintended usage.
  if (href && onClick) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Button] Both `href` and `onClick` were provided. `href` takes precedence and the click handler will be ignored.'
    );
  }

  // Render as a link when `href` exists; otherwise render a button.
  if (href) {
    return (
      <a href={href} className={classes} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} onClick={onClick} style={style} type="button">
      {children}
    </button>
  );
}
