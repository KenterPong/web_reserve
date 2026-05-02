-- 若已執行過舊版 add_blacklist.sql（未含 GRANT），出現 permission denied for table blacklist 時單獨執行本檔即可
GRANT ALL ON TABLE public.blacklist TO service_role;
GRANT ALL ON TABLE public.blacklist TO postgres;
