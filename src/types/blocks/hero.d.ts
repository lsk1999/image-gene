import { Button, Image, Announcement } from "@/types/blocks/base";

export interface Announcement {
  title?: string;
  description?: string;
  label?: string;
  url?: string;
  target?: string;
}

export interface Hero {
  name?: string;
  disabled?: boolean;
  announcement?: Announcement;
  title?: string;
  highlight_text?: string;
  description?: string;
  buttons?: Button[];
  image?: Image;
  after_image?: Image;
  before_label?: string;
  after_label?: string;
  tip?: string;
  benefits?: string[];
  preview_title?: string;
  preview_description?: string;
  preview_status?: string;
  upload_label?: string;
  upload_description?: string;
  control_label?: string;
  control_description?: string;
  show_happy_users?: boolean;
  show_badge?: boolean;
}
