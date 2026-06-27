/**
 * Media Management CLI (v1.1).
 *
 *   npm run media -- stats
 *   npm run media -- gc                 # Dry-Run: report orphans, delete nothing
 *   npm run media -- gc --execute       # actually delete orphan files
 *   npm run media -- integrity
 *   npm run media -- duplicates
 *   npm run media -- thumbnails              # regenerate only MISSING thumbnails
 *   npm run media -- thumbnails --all        # rebuild ALL thumbnails
 *   npm run media -- all                 # run every read-only report
 *
 * Add `--json` to any command for machine-readable output.
 *
 * The CLI opens the same SQLite database the server uses (CATALOG_DB_PATH /
 * catalog.db) and the same uploads dirs (UPLOADS_BASE), so it operates on live
 * data. The two mutating commands (`gc --execute`, `thumbnails`) are CLI-only by
 * design — they are never reachable over HTTP.
 */
import { initDatabase } from '../src/database/index.ts';
import { ProductsService } from '../src/services/products.ts';
import { MediaService } from '../src/services/media.ts';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'help';
const has = (flag: string) => args.includes(flag);
const json = has('--json');

function out(label: string, data: unknown): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function main(): Promise<number> {
  const { db } = initDatabase();
  const media = new MediaService(new ProductsService(db));

  switch (cmd) {
    case 'stats': {
      const s = await media.collectStats();
      out('Media Stats', s);
      if (!json) {
        console.log(
          `\nImages: ${s.images.count} (${fmtBytes(s.images.totalBytes)}, avg ${fmtBytes(s.images.avgBytes)})` +
          ` | Thumbs: ${s.thumbnails.count} (${fmtBytes(s.thumbnails.totalBytes)})` +
          ` | Total on disk: ${fmtBytes(s.totalBytes)}`,
        );
        console.log(
          `Processing since start: ${s.processing.processed} ok, ${s.processing.rejected} rejected, ` +
          `${s.processing.failed} failed, avg ${s.processing.avgProcessingMs}ms`,
        );
      }
      return 0;
    }
    case 'gc': {
      const execute = has('--execute');
      const result = await media.collectGarbage({ execute });
      out(execute ? 'Garbage Collection (EXECUTED)' : 'Garbage Collection (DRY-RUN)', result);
      if (!json) {
        const r = result.report;
        console.log(
          `\nOrphans: ${r.orphans.full.length} full + ${r.orphans.thumbs.length} thumbs` +
          ` (${fmtBytes(r.reclaimableBytes)} reclaimable)`,
        );
        console.log(`Missing: ${r.missing.full.length} full + ${r.missing.thumbs.length} thumbs (need attention)`);
        console.log(
          `Mismatched: ${r.mismatched.fullWithoutThumb.length} full-without-thumb, ` +
          `${r.mismatched.thumbWithoutFull.length} thumb-without-full`,
        );
        if (execute) {
          console.log(`\nDeleted ${result.deleted.full.length} full + ${result.deleted.thumbs.length} thumbs, freed ${fmtBytes(result.freedBytes)}`);
        } else if (r.orphans.full.length + r.orphans.thumbs.length > 0) {
          console.log('\nDry-run only. Re-run with `--execute` to delete the orphan files above.');
        }
      }
      return 0;
    }
    case 'integrity': {
      const r = await media.checkIntegrity();
      out('Image Integrity', r);
      if (!json) console.log(`\nChecked ${r.checked}: ${r.healthy} healthy, ${r.issues.length} with issues`);
      return r.issues.length > 0 && !json ? 0 : 0; // report-only; never fail the process
    }
    case 'duplicates': {
      const r = await media.findDuplicates();
      out('Duplicate Detection', r);
      if (!json) {
        console.log(
          `\n${r.totalFiles} files, ${r.uniqueImages} unique. ` +
          `${r.duplicateGroups.length} duplicate group(s), ${r.duplicateFiles} redundant copies, ` +
          `${fmtBytes(r.wastedBytes)} wasted.`,
        );
      }
      return 0;
    }
    case 'thumbnails': {
      const mode = has('--all') ? 'all' : 'missing';
      const r = await media.regenerateThumbnails({ mode });
      out(`Thumbnail Regeneration (${mode})`, r);
      if (!json) {
        console.log(
          `\nMode ${mode}: ${r.candidates} candidate(s), ${r.regenerated.length} regenerated, ` +
          `${r.failed.length} failed, ${fmtBytes(r.bytesWritten)} written in ${r.elapsedMs}ms`,
        );
      }
      return r.failed.length > 0 ? 1 : 0;
    }
    case 'all': {
      out('Media Stats', await media.collectStats());
      out('Garbage Collection (DRY-RUN)', await media.collectGarbage({ execute: false }));
      out('Image Integrity', await media.checkIntegrity());
      out('Duplicate Detection', await media.findDuplicates());
      return 0;
    }
    default: {
      console.log(`Media Management CLI

Usage: npm run media -- <command> [flags]

Commands:
  stats                 Storage + processing metrics (Observability)
  gc                    Garbage report (Dry-Run — deletes nothing)
  gc --execute          Delete orphan files
  integrity             Per-image health report
  duplicates            SHA-256 duplicate groups
  thumbnails            Regenerate MISSING thumbnails
  thumbnails --all      Rebuild ALL thumbnails
  all                   Run every read-only report

Flags:
  --json                Machine-readable JSON output
`);
      return cmd === 'help' ? 0 : 1;
    }
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
