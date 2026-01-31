import React from 'react';
import { cn } from '../../utils/cn';

interface MobileContainerProps {
    children: React.ReactNode;
    className?: string;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({ children, className }) => {
    return (
        <div className="min-h-screen bg-gray-50 flex justify-center w-full">
            <div className={cn(
                "w-full max-w-md bg-white min-h-screen shadow-xl overflow-hidden relative flex flex-col",
                className
            )}>
                {children}
            </div>
        </div>
    );
};
