# Fotos de las prendas

Las 12 imágenes son fotos de ejemplo generadas con la herramienta integrada
Imagegen. No son fotografías de anuncios reales de Vinted ni acreditan una marca.
Se guardan en `web/public/prendas/PRE001.png` a `PRE012.png` y se relacionan con
los registros de la API mediante `prenda_id`. La interfaz las muestra en las
tarjetas del chat, las miniaturas de documentos y los detalles de las prendas.

## Prompts utilizados

Especificación común aplicada en cada llamada individual:

> Use case: product-mockup. Asset type: individual clothing catalogue photograph
> for a fictional secondhand clothing web app. Subject: [subject below].
> Photorealistic studio product photography, one garment only (one pair for shoes),
> laid flat neatly, front view, entire item visible with comfortable margins,
> square composition, soft warm off-white background, subtle natural shadows,
> diffuse daylight, detailed authentic fabric texture. No people, no mannequin,
> no hangers, no text, no labels, no visible brand logo, no watermark.
> Output one single product photo.

| Registro | Subject |
| --- | --- |
| PRE001 | plain white cotton crewneck T-shirt, very good secondhand condition |
| PRE002 | blue straight-leg denim jeans, lightly worn |
| PRE003 | green floral summer dress, very good secondhand condition |
| PRE004 | blue denim jacket, lightly worn |
| PRE005 | pair of white athletic sneakers, lightly worn, no visible logos |
| PRE006 | beige knitted sweater, very good condition |
| PRE007 | black midi skirt in excellent condition |
| PRE008 | grey knitted winter scarf |
| PRE009 | long brown wool coat |
| PRE010 | red T-shirt with a subtle abstract geometric print, visibly lightly worn |
| PRE011 | sand beige linen blazer in very good condition |
| PRE012 | ecru cream linen summer dress, excellent condition |

En PRE002, PRE007 y PRE011 se usó «one garment only laid flat neatly» en vez de
«one garment only (one pair for shoes), laid flat neatly».
