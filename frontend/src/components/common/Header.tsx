import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { cn } from '../../utils/cn';

interface HeaderProps {
    title?: string;
    showBack?: boolean;
    rightAction?: React.ReactNode;
    className?: string;
    transparent?: boolean;
}

const Header: React.FC<HeaderProps> = ({
    title,
    showBack = true,
    rightAction,
    className,
    transparent = false
}) => {
    const navigate = useNavigate();

    return (
        <header className={cn(
            'flex items-center justify-between px-4 py-4 z-10 sticky top-0',
            !transparent && 'bg-white/80 backdrop-blur-md',
            className
        )}>
            <div className="flex items-center">
                {showBack && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="mr-2 -ml-2 text-gray-800"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                )}
                {title && <h1 className="text-xl font-bold text-gray-900">{title}</h1>}
            </div>

            <div className="flex items-center gap-2">
                {rightAction}
            </div>
        </header>
    );
};

export { Header };
