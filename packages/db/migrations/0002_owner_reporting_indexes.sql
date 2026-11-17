-- Date-range aggregates across all branches and bounded owner history.
CREATE INDEX orders_business_time ON orders(business_id, created_at DESC);
CREATE INDEX orders_business_number ON orders(business_id, number DESC);
CREATE INDEX refunds_time_order ON refunds(created_at, order_id);
