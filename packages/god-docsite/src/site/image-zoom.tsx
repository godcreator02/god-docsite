import { ImageZoom as FumadocsImageZoom, type ImageZoomProps as FumadocsImageZoomProps } from '@fumadocs/base-ui/components/image-zoom'

export type ImageZoomProps = Omit<FumadocsImageZoomProps, 'zoomInProps'> & {
  /** 放大时换上的图（同一张图的高清版）；不给就放大页面上那张 */
  zoomSrc?: string
}

/**
 * 点了在页内放大的图片：MDX 的 Markdown 图片自动用它，TSX 页面与 MDX 里直接写的标签图片要显式写 <ImageZoom src=… />。
 * 页面上放压缩过的图、放大才加载高清版时给 zoomSrc
 */
export function ImageZoom({ zoomSrc, ...props }: ImageZoomProps) {
  return <FumadocsImageZoom {...props} zoomInProps={zoomSrc === undefined ? undefined : { src: zoomSrc }} />
}
