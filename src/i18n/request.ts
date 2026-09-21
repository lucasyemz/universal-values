import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { productLocale } from "./text";
export default getRequestConfig(async()=>({locale:productLocale((await cookies()).get("copyreplace-locale")?.value),messages:{},timeZone:"UTC"}));
