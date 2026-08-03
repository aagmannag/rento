import { v2 as cloudinary } from "cloudinary";

const required = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing Cloudinary env vars: ${missing.join(", ")}`);
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const uploads = [
  {
    name: "Lucknow",
    source: "https://mnmtravels.in/images/blogs/180ca2cdf22de7974b9945075203f47f.PNG",
    publicId: "rento/customer/cities/lucknow",
  },
  {
    name: "Indore",
    source:
      "https://media.istockphoto.com/id/539001564/photo/rajwada-palace-indore.jpg?s=612x612&w=0&k=20&c=ihbWY77GKzZXNmYfvz3dUDpZissBxxcrfSDSMSqa548=",
    publicId: "rento/customer/cities/indore",
  },
];

for (const asset of uploads) {
  const result = await cloudinary.uploader.upload(asset.source, {
    folder: "rento/customer/cities",
    public_id: asset.publicId.split("/").pop(),
    overwrite: true,
    invalidate: true,
    resource_type: "image",
  });

  console.log(`${asset.name}: ${result.secure_url}`);
}