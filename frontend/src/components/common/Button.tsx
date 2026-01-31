import * as React from 'react';
import { cn } from '../../utils/cn';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    fullWidth?: boolean;
}

// Combine Framer Motion props with our custom props
type CombinedProps = ButtonProps & HTMLMotionProps<"button">;

const Button = React.forwardRef<HTMLButtonElement, CombinedProps>(
    ({ className, variant = 'primary', size = 'md', fullWidth = false, children, ...props }, ref) => {
        const variants = {
            primary: 'bg-[#22C522] text-black font-semibold hover:bg-[#1DA81D] active:scale-[0.98]',
            secondary: 'bg-white text-black border border-gray-200 hover:bg-gray-50 active:scale-[0.98]',
            outline: 'bg-transparent text-[#22C522] border border-[#22C522] hover:bg-[#22C522]/10',
            ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
        };

        const sizes = {
            sm: 'h-8 px-3 text-sm',
            md: 'h-12 px-6 text-base', // Made default larger for mobile touch targets
            lg: 'h-14 px-8 text-lg',
            icon: 'h-10 w-10 p-2 flex items-center justify-center',
        };

        return (
            <motion.button
                ref={ref}
                whileTap={{ scale: 0.97 }}
                className={cn(
                    'inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C522] disabled:pointer-events-none disabled:opacity-50',
                    variants[variant],
                    sizes[size],
                    fullWidth && 'w-full',
                    className
                )}
                {...props}
            >
                {children}
            </motion.button>
        );
    }
);
Button.displayName = 'Button';

export { Button };
