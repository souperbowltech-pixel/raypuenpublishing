/**
 * The colour graduation certificate for Book 1.
 *
 * The printed book carries a black and white certificate, because IngramSpark
 * prints a whole book in one ink type and a single colour page would price every
 * page as colour. A line under that certificate sends parents to
 * puenpublishing.com/certificate for this colour version, to print at home.
 *
 * The PDF is the 300 DPI artwork (2550 x 3300 px) on one US Letter page, saved as
 * a JPEG inside the PDF so it downloads at about 2 MB on a phone instead of the
 * 19 MB original. Both files live in /public, so they need no database and keep
 * working even when Supabase is paused.
 */
export const CERTIFICATE_PATH = "/certificate";
export const CERTIFICATE_PDF = "/certificate/geezy-goober-book1-certificate.pdf";
export const CERTIFICATE_PREVIEW = "/certificate/certificate-preview.jpg";
export const CERTIFICATE_DOWNLOAD_NAME = "Geezy-Goober-Graduation-Certificate.pdf";
