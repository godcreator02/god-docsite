import { zonePage } from '@/lib/zone-routes';

const zone = zonePage('collab-merge-check');

export default zone.Page;
export const generateStaticParams = zone.generateStaticParams;
export const generateMetadata = zone.generateMetadata;
