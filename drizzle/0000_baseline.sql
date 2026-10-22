CREATE TYPE "public"."request_status" AS ENUM('pending', 'confirmed', 'denied');--> statement-breakpoint
CREATE TABLE "blueprint" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"mime_type" text NOT NULL,
	"data_base64" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_dates" (
	"request_id" integer NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"room_id" integer NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"group_id" text DEFAULT (gen_random_uuid()::text) NOT NULL,
	"cancel_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"beds" integer NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"hotspot_x" real,
	"hotspot_y" real,
	"hotspot_w" real,
	"hotspot_h" real,
	CONSTRAINT "rooms_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "request_dates" ADD CONSTRAINT "request_dates_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "request_dates_req_date_uq" ON "request_dates" USING btree ("request_id","date");--> statement-breakpoint
CREATE INDEX "request_dates_date_idx" ON "request_dates" USING btree ("date");--> statement-breakpoint
CREATE INDEX "requests_room_idx" ON "requests" USING btree ("room_id","status");--> statement-breakpoint
CREATE INDEX "requests_group_idx" ON "requests" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "requests_cancel_idx" ON "requests" USING btree ("cancel_token");