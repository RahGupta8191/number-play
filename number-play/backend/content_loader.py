"""
Loads and indexes course content from content.json.
Provides fast lookup by question_id, concept_id, subtopic_id.
"""
import json
import os
from typing import Optional, List, Dict, Any

CONTENT_PATH = os.path.join(os.path.dirname(__file__), "data", "content.json")

_content: Dict[str, Any] = {}
_question_index: Dict[str, Dict] = {}   # question_id → question dict (with subtopic/concept metadata)
_subtopic_index: Dict[str, Dict] = {}   # subtopic_id → subtopic dict


def load_content():
    global _content, _question_index, _subtopic_index
    with open(CONTENT_PATH, encoding="utf-8") as f:
        _content = json.load(f)

    for subtopic in _content.get("subtopics", []):
        _subtopic_index[subtopic["id"]] = subtopic
        for concept in subtopic.get("concepts", []):
            for question in concept.get("questions", []):
                q = dict(question)
                q["_subtopic_id"] = subtopic["id"]
                q["_subtopic_name"] = subtopic["name"]
                q["_concept_id"] = concept["id"]
                q["_concept_name"] = concept["name"]
                q["_concept_explanation"] = concept.get("explanation")
                q["_story_example"] = concept.get("story_example")
                q["_solved_examples"] = concept.get("solved_examples", [])
                _question_index[question["id"]] = q


def get_content() -> Dict:
    return _content


def get_question(question_id: str) -> Optional[Dict]:
    return _question_index.get(question_id)


def get_subtopic(subtopic_id: str) -> Optional[Dict]:
    return _subtopic_index.get(subtopic_id)


def get_all_questions_for_subtopic(subtopic_id: str) -> List[Dict]:
    return [q for q in _question_index.values() if q["_subtopic_id"] == subtopic_id]


def get_all_questions_for_concept(concept_id: str) -> List[Dict]:
    return [q for q in _question_index.values() if q["_concept_id"] == concept_id]


def get_questions_ordered() -> List[Dict]:
    """Return all questions sorted by subtopic order, then concept order, then difficulty."""
    result = []
    for subtopic in _content.get("subtopics", []):
        for concept in subtopic.get("concepts", []):
            for q in concept.get("questions", []):
                entry = dict(q)
                entry["_subtopic_id"] = subtopic["id"]
                entry["_subtopic_name"] = subtopic["name"]
                entry["_subtopic_order"] = subtopic["order"]
                entry["_concept_id"] = concept["id"]
                entry["_concept_name"] = concept["name"]
                entry["_concept_order"] = concept["order"]
                entry["_concept_explanation"] = concept.get("explanation")
                entry["_story_example"] = concept.get("story_example")
                entry["_solved_examples"] = concept.get("solved_examples", [])
                result.append(entry)
    return result


def get_metadata() -> Dict:
    subtopics = []
    for st in _content.get("subtopics", []):
        concepts = [{"id": c["id"], "name": c["name"]} for c in st.get("concepts", [])]
        subtopics.append({
            "id": st["id"],
            "name": st["name"],
            "icon": st.get("icon", ""),
            "description": st.get("description", ""),
            "concepts": concepts,
        })
    return {
        "chapter_id": _content.get("chapter_id"),
        "chapter_name": _content.get("chapter_name"),
        "grade": _content.get("grade"),
        "description": _content.get("description"),
        "subtopics": subtopics,
    }
