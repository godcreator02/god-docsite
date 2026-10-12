import { zoneMarkdownRoute } from '@/lib/zone-routes';

export const revalidate = false;

const zone = zoneMarkdownRoute('gitea');

export const GET = zone.GET;
export const generateStaticParams = zone.generateStaticParams;
