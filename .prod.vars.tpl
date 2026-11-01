# 本番用の Worker Secrets の雛形
# vp run deploy:prod で 1Password の参照を解決してアップロードする（1Password を使わない場合は .prod.vars にコピーして値を書き換える）
PUBLIC_ORIGIN=op://Production/email-aliases/website
ADMIN_PASSWORD=op://Production/email-aliases/password
FORWARD_TO=op://Production/email-aliases/FORWARD_TO
