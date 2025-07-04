import Form from 'next/form';

import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CheckCircleFillIcon, ChevronDownIcon, GlobeIcon } from './icons';
import { ReactNode, useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LanguageType } from './lang-selector';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

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

export function AuthForm({
  action,
  children,
  defaultEmail = '',
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
}) {
  const local = useLocale();
  const [open, setOpen] = useState(false);
  const [visibilityType, setVisibilityType] = useState(local);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const t = useTranslations('Account');

  const selectedVisibility = useMemo(
    () => visibilities.find((visibility) => visibility.id === visibilityType),
    [visibilityType],
  );

  return (
    <Form action={action} className="flex flex-col gap-4 px-4 sm:px-16">
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="email"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          {t('email')}
        </Label>

        <Input
          id="email"
          name="email"
          className="bg-muted text-md md:text-sm"
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          required
          autoFocus
          defaultValue={defaultEmail}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="password"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          {t('password')}
        </Label>

        <Input
          id="password"
          name="password"
          className="bg-muted text-md md:text-sm"
          type="password"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="password"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          {t('language')}
        </Label>

        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger
            asChild
            className={cn(
              'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',

            )}
          >
            <Button
              data-testid="visibility-selector"
              variant="outline"
              className="flex justify-between w-full"
            >
              <div className='flex justify-between items-center gap-2'>
                {selectedVisibility?.icon}
                {t(selectedVisibility?.id)}
              </div>

              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-[320px]">
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

              >
                <div className="flex flex-col gap-1 items-start">
                  {t(visibility.id)}
                  {
                    visibility.description && (
                      <div className="text-xs text-muted-foreground">
                        {visibility.description}
                      </div>
                    )
                  }
                </div>
                <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleFillIcon />
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

      </div >

      {children}
    </Form >
  );
}
