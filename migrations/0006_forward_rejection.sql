-- 転送先のメールサーバーが恒久的に拒否したときの理由。拒否されていなければ null
ALTER TABLE received_emails ADD COLUMN forward_rejection TEXT;
