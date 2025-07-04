'use client';

import { ChangeEvent, ChangeEventHandler, type ReactNode, useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    CheckCircleFillIcon,
    ChevronDownIcon,
    GlobeIcon,
    LockIcon,
} from './icons';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { Locale } from 'next-intl';
import { useLocale, useTranslations } from 'use-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { set } from 'date-fns';

export type VisibilityType = 'private' | 'public';
export type LanguageType = 'en' | 'it';

const visibilities: Array<{
    id: LanguageType;
    label: string;
    description: string;
    icon: ReactNode;
}> = [
        {
            id: 'en',
            label: 'English',
            description: '',
            icon: <GlobeIcon />,
        },
        {
            id: 'it',
            label: 'Italian',
            description: '',
            icon: <GlobeIcon />,
        },
    ];

export function LanguageSelector({
    chatId,
    className,
    selectedVisibilityType,
}: {
    chatId: string;
    selectedVisibilityType: VisibilityType;
} & React.ComponentProps<typeof Button>) {

    const locale = useLocale();
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();

    const [open, setOpen] = useState(false);
    const [visibilityType, setVisibilityType] = useState(locale);
    // const [selectedVisibility, setSelectedVisibility] = useState(visibilities[0]);
    const selectedVisibility = useMemo(
        () => visibilities.find((visibility) => visibility.id === visibilityType),
        [visibilityType],
    );
    // useEffect(() => {
    //     if (visibilityType == "en") {
    //         setSelectedVisibility(visibilities[0]);
    //     } else {
    //         setSelectedVisibility(visibilities[1]);
    //     }
    // }, [visibilityType]);



    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger
                asChild
                className={cn(
                    'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
                    className,
                )}
            >
                <Button
                    data-testid="visibility-selector"
                    variant="outline"
                    className="hidden md:flex md:px-2 md:h-[34px]"
                >
                    {selectedVisibility?.icon}
                    {selectedVisibility?.label}
                    {/* <ChevronDownIcon /> */}
                </Button>
            </DropdownMenuTrigger>

            {/* <DropdownMenuContent align="start" className="min-w-[200px]">
                {visibilities.map((visibility) => (
                    <DropdownMenuItem
                        data-testid={`visibility-selector-item-${visibility.id}`}
                        key={visibility.id}
                        onSelect={() => {
                            startTransition(() => {
                                router.replace(
                                    // @ts-expect-error -- TypeScript will validate that only known `params`
                                    // are used in combination with a given `pathname`. Since the two will
                                    // always match for the current route, we can skip runtime checks.
                                    { pathname, params },
                                    { locale: visibility.id }
                                );
                            });
                            setVisibilityType(visibility.id);
                            setOpen(false);
                        }}
                        className="gap-4 group/item flex flex-row justify-between items-center"
                        data-active={visibility.id === visibilityType}
                    >
                        <div className="flex flex-col gap-1 items-start">
                            {visibility.label}
                            {visibility.description && (
                                <div className="text-xs text-muted-foreground">
                                    {visibility.description}
                                </div>
                            )}
                        </div>
                        <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                            <CheckCircleFillIcon />
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent> */}
        </DropdownMenu>
    );
}
