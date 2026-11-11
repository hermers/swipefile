"""Builds the two Swipefile share-sheet shortcuts as signed .shortcut files.

    python3 tools/make_shortcuts.py

Reads the key from .env.local and writes shortcuts/Swipefile.shortcut and
shortcuts/Swipefile image.shortcut. Those files contain your key: the
shortcuts/ folder is gitignored, so don't share them.
"""
import pathlib
import plistlib
import subprocess
import tempfile
import uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
SAVE_URL = "https://cbxhjtbqhlpxrnsundju.supabase.co/functions/v1/inspo/save"


def read_key() -> str:
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith("INSPO_TOKEN="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("INSPO_TOKEN missing from .env.local")


# ---- Shortcuts' serialisation helpers ----

def text(s):
    return {"Value": {"string": s, "attachmentsByRange": {}}, "WFSerializationType": "WFTextTokenString"}


def text_with(att):
    return {"Value": {"string": "￼", "attachmentsByRange": {"{0, 1}": att}}, "WFSerializationType": "WFTextTokenString"}


def attachment(att):
    return {"Value": att, "WFSerializationType": "WFTextTokenAttachment"}


def output(uid, name):
    return {"Type": "ActionOutput", "OutputUUID": uid, "OutputName": name}


SHORTCUT_INPUT = {"Type": "ExtensionInput"}


def fields(items):
    return {"Value": {"WFDictionaryFieldValueItems": items}, "WFSerializationType": "WFDictionaryFieldValue"}


def text_field(key, value):
    return {"WFItemType": 0, "WFKey": text(key), "WFValue": value}


def action(identifier, **params):
    return {"WFWorkflowActionIdentifier": identifier, "WFWorkflowActionParameters": params}


def post(uid, key, body_type, body):
    params = {
        "UUID": uid,
        "WFURL": SAVE_URL,
        "WFHTTPMethod": "POST",
        "ShowHeaders": True,
        "WFHTTPHeaders": fields([text_field("x-swipefile-key", text(key))]),
        "WFHTTPBodyType": body_type,
    }
    if body_type == "JSON":
        params["WFJSONValues"] = body
    else:  # "File": the request body is the file itself
        params["WFRequestVariable"] = body
    return action("is.workflow.actions.downloadurl", **params)


def notify_message(contents_uid):
    value_uid = str(uuid.uuid4()).upper()
    return [
        action(
            "is.workflow.actions.getvalueforkey",
            UUID=value_uid,
            WFGetDictionaryValueType="Value",
            WFDictionaryKey="message",
            WFInput=attachment(output(contents_uid, "Contents of URL")),
        ),
        action(
            "is.workflow.actions.notification",
            WFNotificationActionTitle="Swipefile",
            WFNotificationActionBody=text_with(output(value_uid, "Dictionary Value")),
            WFNotificationActionSound=False,
        ),
    ]


def workflow(actions, inputs, color, glyph):
    return {
        "WFWorkflowClientVersion": "2700.0.0",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": color, "WFWorkflowIconGlyphNumber": glyph},
        "WFWorkflowImportQuestions": [],
        "WFWorkflowTypes": ["ActionExtension"],
        "WFWorkflowInputContentItemClasses": inputs,
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowHasShortcutInputVariables": True,
        "WFWorkflowActions": actions,
    }


def links_shortcut(key):
    uid = str(uuid.uuid4()).upper()
    body = fields([text_field("text", text_with(SHORTCUT_INPUT))])
    return workflow(
        [post(uid, key, "JSON", body), *notify_message(uid)],
        ["WFURLContentItem", "WFStringContentItem"],
        color=4282601983,  # red-orange
        glyph=59511,
    )


def image_shortcut(key):
    convert_uid = str(uuid.uuid4()).upper()
    post_uid = str(uuid.uuid4()).upper()
    convert = action(
        "is.workflow.actions.image.convert",
        UUID=convert_uid,
        WFInput=attachment(SHORTCUT_INPUT),
        WFImageFormat="JPEG",
        WFImageCompressionQuality=0.85,
        WFImagePreserveMetadata=False,
    )
    body = attachment(output(convert_uid, "Converted Image"))
    return workflow(
        [convert, post(post_uid, key, "File", body), *notify_message(post_uid)],
        ["WFImageContentItem", "WFPhotoMediaContentItem"],
        color=4282601983,
        glyph=59511,
    )


def build(name, data):
    out_dir = ROOT / "shortcuts"
    out_dir.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        unsigned = pathlib.Path(tmp) / f"{name}.shortcut"
        unsigned.write_bytes(plistlib.dumps(data, fmt=plistlib.FMT_BINARY))
        signed = out_dir / f"{name}.shortcut"
        subprocess.run(
            ["shortcuts", "sign", "--mode", "anyone", "--input", str(unsigned), "--output", str(signed)],
            check=True,
        )
    signed.chmod(0o600)
    print(f"wrote {signed.relative_to(ROOT)}")


if __name__ == "__main__":
    key = read_key()
    build("Swipefile", links_shortcut(key))
    build("Swipefile image", image_shortcut(key))
