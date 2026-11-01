# ローカル開発用の Secret の雛形
# vp run secrets:dev で 1Password の参照を解決して .dev.vars を作る（1Password を使わない場合は .dev.vars にコピーして値を書き換える）
ADMIN_PASSWORD=op://Development/email-aliases/password
FORWARD_TO=op://Development/email-aliases/FORWARD_TO
