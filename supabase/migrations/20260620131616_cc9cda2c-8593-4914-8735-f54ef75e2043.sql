
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.student_subscriptions;
CREATE POLICY "Users can insert own subscription"
ON public.student_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Users can create own purchases" ON public.video_purchases;
CREATE POLICY "Users can create own purchases"
ON public.video_purchases
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND payment_status = 'pending');
