import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SMOKE_STUDENT_EMAIL,
  DEFAULT_SMOKE_STUDENT_PASSWORD,
  DEFAULT_SMOKE_TEACHER_EMAIL,
  DEFAULT_SMOKE_TEACHER_PASSWORD,
  ensureLiveSmokeBaseline,
} from "./lib/live-smoke-baseline.mjs";

const ZIP_CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }

  return value >>> 0;
});

function loadEnv(filePath) {
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function ensure(value, label) {
  if (!value) {
    throw new Error(`Missing required value: ${label}`);
  }

  return value;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildMinimalPdfBuffer(lines) {
  const stream = [
    "BT",
    "/F1 13 Tf",
    "72 720 Td",
    "18 TL",
    ...lines.flatMap((line, index) => (
      index === 0
        ? [`(${escapePdfText(line)}) Tj`]
        : ["T*", `(${escapePdfText(line)}) Tj`]
    )),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let content = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(content, "utf8"));
    content += object;
  }

  const xrefOffset = Buffer.byteLength(content, "utf8");
  content += `xref\n0 ${objects.length + 1}\n`;
  content += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    content += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(content, "utf8");
}

function crc32(buffer) {
  let value = 0xffffffff;

  for (let index = 0; index < buffer.length; index += 1) {
    value = (value >>> 8) ^ ZIP_CRC32_TABLE[(value ^ buffer[index]) & 0xff];
  }

  return (value ^ 0xffffffff) >>> 0;
}

function encodeDosDateTime(date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);

  return { dosDate, dosTime };
}

function createStoredZipBuffer(entries) {
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;
  const { dosDate, dosTime } = encodeDosDateTime(new Date());

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localRecords.push(localHeader, fileName, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralRecords.push(centralHeader, fileName);
    offset += localHeader.length + fileName.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localRecords, centralDirectory, endOfCentralDirectory]);
}

function buildMinimalDocxBuffer(paragraphs) {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const documentRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Academic Iqama Smoke Test</Application>
</Properties>`;

  const createdAt = new Date().toISOString();
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties
  xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Smoke Test Submission</dc:title>
  <dc:creator>Academic Iqama</dc:creator>
  <cp:lastModifiedBy>Academic Iqama</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
</cp:coreProperties>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map((paragraph) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(paragraph)}</w:t></w:r></w:p>`).join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return createStoredZipBuffer([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(relationships, "utf8") },
    { name: "docProps/app.xml", data: Buffer.from(appXml, "utf8") },
    { name: "docProps/core.xml", data: Buffer.from(coreXml, "utf8") },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") },
    { name: "word/_rels/document.xml.rels", data: Buffer.from(documentRelationships, "utf8") },
    { name: "word/styles.xml", data: Buffer.from(stylesXml, "utf8") },
  ]);
}

function parseSmokeFormat(args) {
  const formatValue = args
    .find((argument) => argument.startsWith("--format="))
    ?.slice("--format=".length)
    .trim()
    .toLowerCase() ?? "pdf";

  if (formatValue !== "pdf" && formatValue !== "docx") {
    throw new Error(`Unsupported smoke format: ${formatValue}. Use --format=pdf or --format=docx.`);
  }

  return formatValue;
}

function buildSmokeParagraphs(format) {
  return [
    `This ${format.toUpperCase()} smoke test validates upload, secure storage, text extraction, and originality analysis in the graduation project platform.`,
    "The submission discusses role-based access control, academic assignments, originality checks, and safe review workflows for student, teacher, and admin portals.",
    "It also mentions Supabase authentication, storage buckets, structured Gemini responses, and evidence-based academic review without automatic disciplinary decisions.",
    "These repeated but meaningful sentences ensure the extracted text is long enough for the automated analysis path instead of the manual review fallback.",
  ];
}

function buildSmokeFileDescriptor(format) {
  const paragraphs = buildSmokeParagraphs(format);

  if (format === "docx") {
    return {
      format,
      fileName: "smoke-test.docx",
      filePathSuffix: "smoke-test.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: buildMinimalDocxBuffer(paragraphs),
      instructions: "Upload the generated DOCX smoke-test file for originality validation.",
    };
  }

  return {
    format,
    fileName: "smoke-test.pdf",
    filePathSuffix: "smoke-test.pdf",
    mimeType: "application/pdf",
    buffer: buildMinimalPdfBuffer(paragraphs),
    instructions: "Upload the generated PDF smoke-test file for originality validation.",
  };
}

async function signInClient(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.user) {
    throw new Error(`Failed to sign in ${email}: ${error?.message ?? "Unknown error"}`);
  }

  return {
    client,
    userId: data.session.user.id,
  };
}

async function cleanupArtifacts(serviceClient, artifact) {
  if (!artifact.cleanup) {
    return;
  }

  if (artifact.filePath) {
    await serviceClient.storage.from("student-submissions").remove([artifact.filePath]);
  }

  if (artifact.submissionId) {
    await serviceClient.from("submission_matches").delete().eq("submission_id", artifact.submissionId);
    await serviceClient.from("originality_checks").delete().eq("submission_id", artifact.submissionId);
    await serviceClient.from("reviews").delete().eq("submission_id", artifact.submissionId);
    await serviceClient.from("submissions").delete().eq("id", artifact.submissionId);
  }

  if (artifact.assignmentId) {
    await serviceClient.from("assignments").delete().eq("id", artifact.assignmentId);
  }

  if (artifact.studentSubjectMappingId) {
    await serviceClient.from("student_subjects").delete().eq("id", artifact.studentSubjectMappingId);
  }
}

async function main() {
  const rootDir = process.cwd();
  const rootEnv = loadEnv(path.join(rootDir, ".env.local"));
  const functionEnv = loadEnv(path.join(rootDir, "supabase", ".env.local"));

  const url = ensure(rootEnv.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
  const anonKey = ensure(rootEnv.VITE_SUPABASE_PUBLISHABLE_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = ensure(functionEnv.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");

  const teacherEmail = process.env.SMOKE_TEACHER_EMAIL ?? DEFAULT_SMOKE_TEACHER_EMAIL;
  const teacherPassword = process.env.SMOKE_TEACHER_PASSWORD ?? DEFAULT_SMOKE_TEACHER_PASSWORD;
  const studentEmail = process.env.SMOKE_STUDENT_EMAIL ?? DEFAULT_SMOKE_STUDENT_EMAIL;
  const studentPassword = process.env.SMOKE_STUDENT_PASSWORD ?? DEFAULT_SMOKE_STUDENT_PASSWORD;
  const format = parseSmokeFormat(process.argv.slice(2));
  const cleanup = process.argv.includes("--cleanup");
  const fileDescriptor = buildSmokeFileDescriptor(format);

  const artifact = {
    cleanup,
    assignmentId: null,
    submissionId: null,
    filePath: null,
  };

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    await ensureLiveSmokeBaseline({
      url,
      serviceRoleKey,
      teacherEmail,
      teacherPassword,
      studentEmail,
      studentPassword,
    });

    const teacherSession = await signInClient(url, anonKey, teacherEmail, teacherPassword);
    const studentSession = await signInClient(url, anonKey, studentEmail, studentPassword);

    const [{ data: teacherProfile }, { data: studentProfile }, { data: mapping }] = await Promise.all([
      serviceClient.from("profiles").select("id,full_name").eq("id", teacherSession.userId).single(),
      serviceClient.from("profiles").select("id,full_name,academic_id").eq("id", studentSession.userId).single(),
      serviceClient
        .from("teacher_subjects")
        .select("subject_id, level, semester")
        .eq("teacher_id", teacherSession.userId)
        .limit(1)
        .single(),
    ]);

    if (!teacherProfile || !studentProfile || !mapping) {
      throw new Error("Missing teacher/student profile or teacher subject mapping for smoke test");
    }

    const { data: subject } = await serviceClient
      .from("subjects")
      .select("id, name_ar, level")
      .eq("id", mapping.subject_id)
      .single();

    if (!subject) {
      throw new Error("Subject not found for teacher mapping");
    }

    const { data: existingStudentMapping } = await serviceClient
      .from("student_subjects")
      .select("id")
      .eq("student_id", studentProfile.id)
      .eq("subject_id", subject.id)
      .maybeSingle();

    if (!existingStudentMapping) {
      const { data: studentMapping, error: studentMappingError } = await serviceClient
        .from("student_subjects")
        .insert({
          student_id: studentProfile.id,
          subject_id: subject.id,
        })
        .select("id")
        .single();

      if (studentMappingError || !studentMapping) {
        throw new Error(`Failed to enroll smoke student in subject: ${studentMappingError?.message ?? "Unknown error"}`);
      }

      artifact.studentSubjectMappingId = studentMapping.id;
    }

    const assignmentTitle = `[SMOKE][${format.toUpperCase()}] Originality Assignment ${Date.now()}`;
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

    const { data: assignment, error: assignmentError } = await teacherSession.client
      .from("assignments")
      .insert({
        title: assignmentTitle,
        subject: subject.name_ar,
        subject_id: subject.id,
        teacher_id: teacherProfile.id,
        teacher_name: teacherProfile.full_name,
        level: subject.level || mapping.level,
        due_at: dueAt,
        due_time: new Date(dueAt).toISOString().slice(11, 19),
        description: "Temporary smoke test assignment",
        instructions: fileDescriptor.instructions,
        allowed_formats: ["PDF", "DOCX"],
        max_submissions: 1,
        attachments: [],
        has_attachment: false,
        resubmission_policy: "single_attempt",
        status: "published",
      })
      .select("id,title,subject_id")
      .single();

    if (assignmentError || !assignment) {
      throw new Error(`Failed to create assignment: ${assignmentError?.message ?? "Unknown error"}`);
    }

    artifact.assignmentId = assignment.id;

    const filePath = `${studentProfile.id}/${assignment.id}/${Date.now()}-${fileDescriptor.filePathSuffix}`;

    const { error: uploadError } = await studentSession.client.storage
      .from("student-submissions")
      .upload(filePath, fileDescriptor.buffer, {
        contentType: fileDescriptor.mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload smoke ${format.toUpperCase()}: ${uploadError.message}`);
    }

    artifact.filePath = filePath;

    const submissionId = crypto.randomUUID();
    const submittedAt = new Date().toISOString();

    const { data: submission, error: submissionError } = await studentSession.client
      .from("submissions")
      .insert({
        id: submissionId,
        assignment_id: assignment.id,
        student_id: studentProfile.id,
        student_name: studentProfile.full_name,
        academic_id: studentProfile.academic_id,
        file_name: fileDescriptor.fileName,
        file_path: filePath,
        file_mime_type: fileDescriptor.mimeType,
        file_size: formatFileSize(fileDescriptor.buffer.byteLength),
        notes: "Automated smoke test submission",
        submitted_at: submittedAt,
        originality: 0,
        status: "submitted",
        grade: null,
        feedback: "",
        semester: mapping.semester || subject.level || "",
        analysis_status: "pending",
        analysis_requested_at: submittedAt,
        analysis_completed_at: null,
        analysis_error: "",
        latest_originality_check_id: null,
        events: [],
      })
      .select("id")
      .single();

    if (submissionError || !submission) {
      throw new Error(`Failed to create submission: ${submissionError?.message ?? "Unknown error"}`);
    }

    artifact.submissionId = submission.id;

    const { error: functionError } = await studentSession.client.functions.invoke("analyze-submission", {
      body: {
        submission_id: submission.id,
      },
    });

    if (functionError) {
      const responseText = functionError.context ? await functionError.context.text() : functionError.message;
      throw new Error(`Failed to invoke analyze-submission: ${responseText}`);
    }

    let finalSubmission = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { data } = await serviceClient
        .from("submissions")
        .select("id, analysis_status, analysis_error, originality, latest_originality_check_id")
        .eq("id", submission.id)
        .single();

      if (
        data
        && data.analysis_status !== "pending"
        && data.analysis_status !== "processing"
      ) {
        finalSubmission = data;
        break;
      }

      await wait(5000);
    }

    if (!finalSubmission) {
      throw new Error("Smoke test timed out while waiting for analysis completion");
    }

    const [{ data: checks }, { data: matches }] = await Promise.all([
      serviceClient
        .from("originality_checks")
        .select("id,analysis_status,originality_score,matching_percentage,risk_level,recommended_status")
        .eq("submission_id", submission.id),
      serviceClient
        .from("submission_matches")
        .select("id,similarity_score,match_type,source_scope")
        .eq("submission_id", submission.id),
    ]);

    console.log(JSON.stringify({
      ok: true,
      assignment: {
        id: assignment.id,
        title: assignment.title,
        subject_id: assignment.subject_id,
      },
      file: {
        format: fileDescriptor.format,
        name: fileDescriptor.fileName,
        mime_type: fileDescriptor.mimeType,
        size: formatFileSize(fileDescriptor.buffer.byteLength),
      },
      submission: finalSubmission,
      originality_checks: checks ?? [],
      submission_matches: matches ?? [],
      cleanup_hint: cleanup ? "artifacts deleted" : "run with --cleanup to remove smoke-test rows",
    }, null, 2));
  } finally {
    await cleanupArtifacts(serviceClient, artifact);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : "Unknown error",
  }, null, 2));
  process.exit(1);
});
