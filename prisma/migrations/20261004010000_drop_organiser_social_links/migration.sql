-- Website and social links were stored but never shown or editable, and are
-- not part of the MVP. Any values held in these columns are discarded.
-- AlterTable
ALTER TABLE "organisers" DROP COLUMN "facebook",
DROP COLUMN "instagram",
DROP COLUMN "website";
