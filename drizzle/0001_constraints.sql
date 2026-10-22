DROP INDEX "request_dates_req_date_uq";--> statement-breakpoint
ALTER TABLE "request_dates" ADD CONSTRAINT "request_dates_pkey" PRIMARY KEY("request_id","date");--> statement-breakpoint
ALTER TABLE "blueprint" ADD CONSTRAINT "blueprint_single_row" CHECK (id = 1);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_beds_nonnegative" CHECK ("rooms"."beds" >= 0);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotspot_range" CHECK ("rooms"."hotspot_x" BETWEEN 0 AND 100 AND "rooms"."hotspot_y" BETWEEN 0 AND 100
        AND "rooms"."hotspot_w" BETWEEN 0 AND 100 AND "rooms"."hotspot_h" BETWEEN 0 AND 100);