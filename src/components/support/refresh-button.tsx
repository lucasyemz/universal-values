'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useText } from '@/i18n/use-text';
export function RefreshSupport(){const router=useRouter(),t=useText();const [pending,start]=useTransition();return <button type="button" className="ui-btn mt-4" disabled={pending} onClick={()=>start(()=>router.refresh())}>{t(pending?'Carregando…':'Atualizar')}</button>;}
