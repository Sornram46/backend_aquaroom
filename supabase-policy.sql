-- ใช้รูปแบบ WITH CHECK แทน USING สำหรับ INSERT

create policy "Allow service role upload"
on storage.objects
for insert
with check (auth.role() = 'service_role');
