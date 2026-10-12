import { zoneMarkdownRoute } from '@/lib/zone-routes';

export const revalidate = false;

const zone = zoneMarkdownRoute('collab-model');

export const GET = zone.GET;
export const generateStaticParams = zone.generateStaticParams;
