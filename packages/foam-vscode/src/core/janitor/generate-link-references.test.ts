import { generateLinkReferences } from '.';
import { TEST_DATA_DIR } from '../../test/test-utils';
import { MarkdownResourceProvider } from '../services/markdown-provider';
import { Resource } from '../model/note';
import { Range } from '../model/range';
import { FoamWorkspace } from '../model/workspace';
import { Logger } from '../utils/log';
import fs from 'fs';
import { URI } from '../model/uri';
import { EOL } from 'os';
import { createMarkdownParser } from '../services/markdown-parser';
import { FileDataStore } from '../../test/test-datastore';

Logger.setLevel('error');

describe('generateLinkReferences', () => {
  let _workspace: FoamWorkspace;
  // TODO slug must be reserved for actual slugs, not file names
  const findBySlug = (slug: string): Resource => {
    return _workspace
      .list()
      .find(res => res.uri.getName() === slug) as Resource;
  };

  beforeAll(async () => {
    /** Use fs for reading files in units where vscode.workspace is unavailable */
    const readFile = async (uri: URI) =>
      (await fs.promises.readFile(uri.toFsPath())).toString();
    const dataStore = new FileDataStore(
      readFile,
      TEST_DATA_DIR.joinPath('__scaffold__').toFsPath()
    );
    const parser = createMarkdownParser();
    const mdProvider = new MarkdownResourceProvider(dataStore, parser);
    _workspace = await FoamWorkspace.fromProviders([mdProvider], dataStore);
  });

  it('initialised test graph correctly', () => {
    expect(_workspace.list().length).toEqual(10);
  });

  it('should add link references to a file that does not have them', async () => {
    const note = findBySlug('index');
    const expected = {
      newText: textForNote(
        `
[//begin]: # "Autogenerated link references for markdown compatibility"
[first-document]: first-document "First Document"
[second-document]: second-document "Second Document"
[file-without-title]: file-without-title "file-without-title"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(9, 0, 9, 0),
    };
    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = EOL;
    const actual = await generateLinkReferences(
      note,
      noteText,
      noteEol,
      _workspace,
      false
    );

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should remove link definitions from a file that has them, if no links are present', async () => {
    const note = findBySlug('second-document');

    const expected = {
      newText: '',
      range: Range.create(6, 0, 8, 42),
    };

    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = EOL;
    const actual = await generateLinkReferences(
      note,
      noteText,
      noteEol,
      _workspace,
      false
    );

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should update link definitions if they are present but changed', async () => {
    const note = findBySlug('first-document');

    const expected = {
      newText: textForNote(
        `[//begin]: # "Autogenerated link references for markdown compatibility"
[file-without-title]: file-without-title "file-without-title"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(8, 0, 10, 42),
    };

    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = EOL;
    const actual = await generateLinkReferences(
      note,
      noteText,
      noteEol,
      _workspace,
      false
    );

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not cause any changes if link reference definitions were up to date', async () => {
    const note = findBySlug('third-document');

    const expected = null;

    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = EOL;
    const actual = await generateLinkReferences(
      note,
      noteText,
      noteEol,
      _workspace,
      false
    );

    expect(actual).toEqual(expected);
  });

  it('should encode spaces links', async () => {
    const note = findBySlug('angel-reference');
    const expected = {
      newText: textForNote(
        `
[//begin]: # "Autogenerated link references for markdown compatibility"
[Note being referred as angel]: Note%20being%20referred%20as%20angel "Note being referred as angel"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(3, 0, 3, 0),
    };

    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = EOL;
    const actual = await generateLinkReferences(
      note,
      noteText,
      noteEol,
      _workspace,
      false
    );

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not remove explicitly entered link references', async () => {
    const note = findBySlug('file-with-explicit-link-references');
    const expected = null;

    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = EOL;
    const actual = await generateLinkReferences(
      note,
      noteText,
      noteEol,
      _workspace,
      false
    );

    expect(actual).toEqual(expected);
  });

  it('should not remove explicitly entered link references and have an implicit link', async () => {
    const note = findBySlug('file-with-explicit-and-implicit-link-references');
    const expected = {
      newText: textForNote(
        `[//begin]: # "Autogenerated link references for markdown compatibility"
[first-document]: first-document "First Document"
[//end]: # "Autogenerated link references"`
      ),
      range: Range.create(8, 0, 10, 42),
    };

    const noteText = await _workspace.readAsMarkdown(note.uri);
    const noteEol = EOL;
    const actual = await generateLinkReferences(
      note,
      noteText,
      noteEol,
      _workspace,
      false
    );

    expect(actual).toEqual(expected);
  });
});

/**
 * Will adjust a text line separator to match
 * what is used by the note
 * Necessary when running tests on windows
 *
 * @param note the note we are adjusting for
 * @param text starting text, using a \n line separator
 */
function textForNote(text: string): string {
  const eol = EOL;
  return text.split('\n').join(eol);
}
